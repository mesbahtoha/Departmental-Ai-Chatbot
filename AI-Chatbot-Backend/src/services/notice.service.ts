import pdfParse from 'pdf-parse';
import { noticeRepository, chunkRepository } from '../repositories/notice.repository';
import { uploadBuffer, deleteGridFSFile, safeObjectId } from '../config/gridfs';
import OpenRouterClient, { ChatMessageInput } from './openrouter.client';
import {
  buildPreview,
  chunkText,
  normalizeForSearch,
  normalizeText,
  now,
} from '../utils/text.utils';
import { log } from '../config/logger';

export interface ExtractionResult {
  sourceType: 'pdf' | 'image' | 'text' | 'file';
  extractedText: string;
  mimeType: string;
  originalFileName: string | null;
  fileId: unknown;
}

/**
 * Notice service - upload, extract text (PDF / image OCR / plain text),
 * summarize, chunk and index notices. Behavior ported 1:1 from legacy.
 */
export const noticeService = {
  /** Extracts text from an uploaded file / pasted text. */
  async extractTextFromUploadedInput(input: {
    file?: Express.Multer.File | null;
    textContent: string;
    title: string;
  }): Promise<ExtractionResult> {
    const typedText = normalizeText(input.textContent || '');
    let extractedText = typedText;
    let sourceType: ExtractionResult['sourceType'] = 'text';

    if (!input.file) {
      return {
        sourceType,
        extractedText,
        mimeType: 'text/plain',
        originalFileName: null,
        fileId: null,
      };
    }

    const file = input.file;
    sourceType =
      file.mimetype === 'application/pdf'
        ? 'pdf'
        : file.mimetype.startsWith('image/')
          ? 'image'
          : file.mimetype.startsWith('text/')
            ? 'text'
            : 'file';

    const fileId = await uploadBuffer(
      file.buffer,
      `${Date.now()}-${file.originalname}`,
      file.mimetype,
      {
        originalname: file.originalname,
        uploadedAt: now(),
        title: input.title || file.originalname,
      }
    );

    let fileExtractedText = '';

    if (file.mimetype === 'text/plain') {
      fileExtractedText = normalizeText(file.buffer.toString('utf8'));
    } else if (file.mimetype === 'application/pdf') {
      try {
        const parsed = await pdfParse(file.buffer);
        fileExtractedText = normalizeText(parsed.text || '');
      } catch (error) {
        log.warn('PDF parse failed', { message: (error as Error).message });
        fileExtractedText = '';
      }
    } else if (file.mimetype.startsWith('image/')) {
      fileExtractedText = await this.extractTextFromImage(file.buffer, file.mimetype, input.title);
    }

    extractedText = normalizeText([typedText, fileExtractedText].filter(Boolean).join('\n\n'));

    return {
      sourceType,
      extractedText,
      mimeType: file.mimetype,
      originalFileName: file.originalname,
      fileId,
    };
  },

  /** OCR: asks the vision model to extract text from an image. */
  async extractTextFromImage(buffer: Buffer, mimeType: string, title = ''): Promise<string> {
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract all readable text from this image.',
              'Keep headings, dates, numbers, serials, tables, bullet lines, and notices as plain text.',
              'Do not summarize.',
              'If some words are unclear, keep the readable parts only.',
              title ? `Document title: ${title}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];

    try {
      const { text } = await OpenRouterClient.complete(messages as never, {
        temperature: 0,
        maxTokens: 1200,
      });
      return normalizeText(text);
    } catch (error) {
      log.warn('Image OCR failed', { message: (error as Error).message });
      return '';
    }
  },

  /** Generates a short summary for a notice using the AI. */
  async generateSummary(text: string, title = ''): Promise<string> {
    const clean = normalizeText(text);
    if (!clean) return '';

    const messages: ChatMessageInput[] = [
      {
        role: 'system',
        content:
          'You summarize university notices. Keep the summary factual, compact, and within 2 short lines. Focus on title, dates, deadline, and action.',
      },
      {
        role: 'user',
        content: [
          'Summarize this notice briefly.',
          'Do not invent anything.',
          title ? `Title: ${title}` : '',
          `Notice text:\n${clean.slice(0, 3000)}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ];

    try {
      const { text: summary } = await OpenRouterClient.complete(messages, {
        temperature: 0.1,
        maxTokens: 140,
      });
      return summary || buildPreview(clean, 240);
    } catch (error) {
      log.warn('Summary generation failed, using preview', { message: (error as Error).message });
      return buildPreview(clean, 240);
    }
  },

  /** Deletes + rebuilds the keyword chunks for a notice. */
  async rebuildChunksForDocument(document: {
    _id: unknown;
    title: string;
    category: string;
    rawText: string;
  }): Promise<number> {
    const documentId = document._id;
    const fullText = normalizeText(document.rawText || '');
    const pieces = chunkText(fullText);

    await chunkRepository.deleteByDocument(documentId);

    if (!pieces.length) return 0;

    const docs = pieces.map((piece, index) => ({
      documentId,
      title: document.title,
      category: document.category,
      chunkIndex: index,
      chunkText: piece,
      normalizedChunkText: normalizeForSearch(piece),
      preview: buildPreview(piece, 220),
    }));

    return chunkRepository.insertMany(docs);
  },

  async deleteNoticeAndFile(noticeId: unknown): Promise<void> {
    const notice = await noticeRepository.findById(noticeId);
    if (!notice) return;

    await chunkRepository.deleteByDocument(notice._id);
    await noticeRepository.delete(notice._id);
    if (notice.fileId) {
      await deleteGridFSFile(safeObjectId(String(notice.fileId)));
    }
  },

  async createNotice(input: {
    title: string;
    category: string;
    textContent: string;
    file?: Express.Multer.File | null;
    uploadedBy?: string;
  }) {
    const extraction = await this.extractTextFromUploadedInput({
      file: input.file,
      textContent: input.textContent,
      title: input.title,
    });

    if (!extraction.extractedText) {
      const error = new Error(
        'Could not extract any usable text from the uploaded input. For scanned PDFs, upload the text or an image version.'
      ) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const summary = await this.generateSummary(extraction.extractedText, input.title);

    const document = await noticeRepository.create({
      title: input.title,
      category: input.category,
      type: extraction.sourceType,
      mimeType: extraction.mimeType,
      originalFileName: extraction.originalFileName,
      fileId: extraction.fileId,
      rawText: extraction.extractedText,
      normalizedText: normalizeForSearch(extraction.extractedText),
      summary,
      uploadedBy: input.uploadedBy || 'admin',
      status: 'processing',
    } as never);

    const chunkCount = await this.rebuildChunksForDocument(document);

    const updated = await noticeRepository.update(document._id, {
      status: 'ready',
      chunkCount,
    });

    if (!updated) {
      await deleteGridFSFile(extraction.fileId as never);
      throw new Error('Failed to persist notice');
    }

    return {
      _id: document._id,
      title: updated.title,
      category: updated.category,
      type: updated.type,
      summary: updated.summary,
      fileId: updated.fileId,
      fileUrl: updated.fileId ? `/api/files/${updated.fileId}` : null,
      chunkCount: updated.chunkCount,
      status: updated.status,
    };
  },

  async updateNotice(noticeId: unknown, payload: { title?: string; category?: string; textContent?: string }) {
    const existing = await noticeRepository.findById(noticeId);
    if (!existing) return null;

    const updateFields: Record<string, unknown> = {};

    if (payload.title) updateFields.title = normalizeText(payload.title);
    if (payload.category) updateFields.category = normalizeText(payload.category);

    let mustReindex = false;

    if (typeof payload.textContent === 'string') {
      const clean = normalizeText(payload.textContent);
      updateFields.rawText = clean;
      updateFields.normalizedText = normalizeForSearch(clean);
      updateFields.summary = await this.generateSummary(clean, (updateFields.title as string) || existing.title);
      mustReindex = true;
    }

    const updated = await noticeRepository.update(noticeId, updateFields);

    if (mustReindex && updated) {
      const chunkCount = await this.rebuildChunksForDocument(updated);
      await noticeRepository.update(updated._id, { chunkCount, status: 'ready' });
    }

    if (!updated) return null;
    return this.getPayload(updated);
  },

  getPayload(doc: {
    _id: unknown;
    title: string;
    category: string;
    type: string;
    mimeType: string;
    summary: string;
    rawText: string;
    fileId?: unknown;
    originalFileName?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      _id: doc._id,
      title: doc.title,
      category: doc.category,
      type: doc.type,
      mimeType: doc.mimeType,
      summary: doc.summary,
      fullText: doc.rawText,
      fileId: doc.fileId ?? null,
      fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
      originalFileName: doc.originalFileName || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
};

export default noticeService;
