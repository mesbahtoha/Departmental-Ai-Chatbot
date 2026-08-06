const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { Readable } = require("stream");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");

dotenv.config();


// ✅ NEW CODE (ADD THIS — replace na, just add)
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err);
});


const app = express();
const port = Number(process.env.PORT || 3000);

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "ChatBot_DB";

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
const openrouterBaseUrl =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const openrouterModel =
  process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const openrouterMaxTokens = Number(process.env.OPENROUTER_MAX_TOKENS || 700);

const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
const appTitle = process.env.APP_TITLE || "Department Notice Bot";
const corsOrigin = process.env.CORS_ORIGIN || "*";

if (!uri) {
  throw new Error("MONGO_URI is missing in .env");
}

if (!openrouterApiKey) {
  throw new Error("OPENROUTER_API_KEY is missing in .env");
}

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "image/bmp",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, TXT, JPEG, PNG, WEBP, JPG and BMP files are allowed"
        )
      );
    }
  },
});

const client = new MongoClient(uri);

let db;
let bucket;
let usersCollection;
let adminCollection;
let documentsCollection;
let chunksCollection;
let chatLogsCollection;
let feedbackCollection;

function now() {
  return new Date();
}

function safeObjectId(id) {
  try {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

function escapeRegex(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text = "") {
  return String(text)
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForSearch(text = "") {
  return normalizeText(text).toLowerCase();
}

function buildPreview(text = "", maxLength = 280) {
  const clean = normalizeText(text).replace(/\n/g, " ");
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}...`;
}

function uniqueArray(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function tokenize(text = "") {
  return normalizeForSearch(text)
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function removeStopWords(words = []) {
  const stop = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "am",
    "i",
    "you",
    "he",
    "she",
    "it",
    "they",
    "we",
    "to",
    "for",
    "of",
    "in",
    "on",
    "at",
    "and",
    "or",
    "from",
    "with",
    "by",
    "about",
    "what",
    "when",
    "where",
    "which",
    "who",
    "how",
    "do",
    "does",
    "did",
    "can",
    "could",
    "please",
    "tell",
    "me",
    "my",
    "our",
    "your",
    "notice",
    "notices",
    "department",
    "university",
    "give",
    "show",
  ]);
  return words.filter((w) => !stop.has(w));
}

function chunkText(text = "", chunkWordSize = 180, overlapWords = 40) {
  const clean = normalizeText(text);
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return [];

  const chunks = [];
  let buffer = [];

  function flushBuffer() {
    if (!buffer.length) return;
    const piece = buffer.join("\n\n").trim();
    if (piece) chunks.push(piece);
    buffer = [];
  }

  for (const paragraph of paragraphs) {
    const paraWords = paragraph.split(/\s+/);
    if (paraWords.length > chunkWordSize * 1.4) {
      flushBuffer();
      let start = 0;
      while (start < paraWords.length) {
        const end = Math.min(start + chunkWordSize, paraWords.length);
        const chunk = paraWords.slice(start, end).join(" ").trim();
        if (chunk) chunks.push(chunk);
        if (end === paraWords.length) break;
        start = Math.max(end - overlapWords, start + 1);
      }
      continue;
    }

    const currentWords = buffer.join(" ").split(/\s+/).filter(Boolean).length;
    if (currentWords + paraWords.length <= chunkWordSize) {
      buffer.push(paragraph);
    } else {
      flushBuffer();
      buffer.push(paragraph);
    }
  }

  flushBuffer();

  return uniqueArray(chunks);
}

function isGreetingIntent(query = "") {
  const q = normalizeForSearch(query);
  return /^(hi|hello|hey|assalamu alaikum|salam|good morning|good evening|good afternoon)\b/.test(
    q
  );
}

function isSummaryIntent(query = "") {
  const q = normalizeForSearch(query);
  const patterns = [
    /\bsummar(y|ize|ise)\b/,
    /\bbrief\b/,
    /\bshort\b/,
    /\boverview\b/,
    /\bgist\b/,
    /সংক্ষেপ/,
    /সারাংশ/,
    /ছোট করে/,
  ];
  return patterns.some((pattern) => pattern.test(q));
}

function isFullNoticeIntent(query = "") {
  const q = normalizeForSearch(query);

  const patterns = [
    /\bfull\b/,
    /\bcomplete\b/,
    /\boriginal\b/,
    /\bopen\b/,
    /\bshow\b.*\b(pdf|image|notice|routine|document|file)\b/,
    /\bgive\b.*\b(pdf|image|notice|routine|document|file)\b/,
    /পুরো/,
    /ফুল/,
    /সম্পূর্ণ/,
    /নোটিশটা দাও/,
    /রুটিনটা দাও/,
    /পিডিএফ/,
    /ইমেজ/,
    /ছবিটা দাও/,
    /পুরোটা/,
  ];

  return patterns.some((pattern) => pattern.test(q));
}

function detectLanguage(query = "") {
  const bnRegex = /[\u0980-\u09FF]/;
  return bnRegex.test(query) ? "bn" : "en";
}

function listRoutes() {
  return [
    "GET /",
    "GET /api/test",
    "GET /api/routes",
    "GET /users",
    "POST /users",
    "POST /api/admin/notices",
    "GET /api/admin/notices",
    "GET /api/admin/notices/:id",
    "PUT /api/admin/notices/:id",
    "POST /api/admin/notices/:id/reindex",
    "DELETE /api/admin/notices/:id",
    "GET /api/files/:fileId",
    "GET /api/student/search",
    "GET /api/student/notices/:id/full",
    "POST /api/student/query",
    "POST /api/ai/ask",
    "POST /api/feedback",
  ];
}

function extractCompletionText(json) {
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.text) return item.text;
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function askOpenRouter(messages, options = {}) {
  const response = await fetch(`${openrouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appBaseUrl,
      "X-OpenRouter-Title": appTitle,
    },
    body: JSON.stringify({
      model: options.model || openrouterModel,
      messages,
      temperature: options.temperature ?? 0.15,
      max_tokens: options.maxTokens || openrouterMaxTokens,
      response_format: options.responseFormat,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `OpenRouter request failed with status ${response.status}`;
    throw new Error(message);
  }

  return extractCompletionText(data);
}

async function extractTextFromImageWithOpenRouter(buffer, mimeType, title = "") {
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "Extract all readable text from this image.",
            "Keep headings, dates, numbers, serials, tables, bullet lines, and notices as plain text.",
            "Do not summarize.",
            "If some words are unclear, keep the readable parts only.",
            title ? `Document title: ${title}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        {
          type: "image_url",
          image_url: {
            url: dataUrl,
          },
        },
      ],
    },
  ];

  const extracted = await askOpenRouter(messages, {
    temperature: 0,
    maxTokens: 1200,
  });

  return normalizeText(extracted);
}

async function uploadBufferToGridFS(buffer, filename, mimeType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType,
      metadata,
    });

    Readable.from(buffer)
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => resolve(uploadStream.id));
  });
}

async function deleteGridFSFile(fileId) {
  if (!fileId) return;
  const objectId = safeObjectId(fileId);
  if (!objectId) return;

  try {
    await bucket.delete(objectId);
  } catch (error) {
    // ignore delete errors
  }
}

async function extractTextFromUploadedInput({ file, textContent, title }) {
  const typedText = normalizeText(textContent || "");
  let extractedText = typedText;
  let sourceType = "text";

  if (!file) {
    return {
      sourceType,
      extractedText,
      mimeType: "text/plain",
      originalFileName: null,
      fileId: null,
    };
  }

  sourceType =
    file.mimetype === "application/pdf"
      ? "pdf"
      : file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("text/")
      ? "text"
      : "file";

  const fileId = await uploadBufferToGridFS(
    file.buffer,
    `${Date.now()}-${file.originalname}`,
    file.mimetype,
    {
      originalname: file.originalname,
      uploadedAt: now(),
      title: title || file.originalname,
    }
  );

  let fileExtractedText = "";

  if (file.mimetype === "text/plain") {
    fileExtractedText = normalizeText(file.buffer.toString("utf8"));
  } else if (file.mimetype === "application/pdf") {
    try {
      const parsed = await pdfParse(file.buffer);
      fileExtractedText = normalizeText(parsed.text || "");
    } catch (error) {
      fileExtractedText = "";
    }
  } else if (file.mimetype.startsWith("image/")) {
    fileExtractedText = await extractTextFromImageWithOpenRouter(
      file.buffer,
      file.mimetype,
      title
    );
  }

  extractedText = normalizeText(
    [typedText, fileExtractedText].filter(Boolean).join("\n\n")
  );

  return {
    sourceType,
    extractedText,
    mimeType: file.mimetype,
    originalFileName: file.originalname,
    fileId,
  };
}

async function generateSummary(text = "", title = "") {
  const clean = normalizeText(text);
  if (!clean) return "";

  const messages = [
    {
      role: "system",
      content:
        "You summarize university notices. Keep the summary factual, compact, and within 2 short lines. Focus on title, dates, deadline, and action.",
    },
    {
      role: "user",
      content: [
        "Summarize this notice briefly.",
        "Do not invent anything.",
        title ? `Title: ${title}` : "",
        `Notice text:\n${clean.slice(0, 3000)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  try {
    const summary = await askOpenRouter(messages, {
      temperature: 0.1,
      maxTokens: 140,
    });
    return summary || buildPreview(clean, 240);
  } catch (error) {
    return buildPreview(clean, 240);
  }
}

function computeKeywordScore(haystack = "", query = "") {
  const text = normalizeForSearch(haystack);
  const q = normalizeForSearch(query);

  if (!text || !q) return 0;

  let score = 0;

  if (text.includes(q)) score += 50;

  const queryTokens = removeStopWords(tokenize(q));
  for (const token of queryTokens) {
    const regex = new RegExp(`\\b${escapeRegex(token)}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) score += matches.length * 6;
  }

  return score;
}

async function rebuildChunksForDocument(document) {
  const documentId = document._id;
  const fullText = normalizeText(document.rawText || "");
  const pieces = chunkText(fullText);

  await chunksCollection.deleteMany({ documentId });

  if (!pieces.length) return 0;

  const docs = pieces.map((piece, index) => ({
    documentId,
    title: document.title,
    category: document.category,
    chunkIndex: index,
    chunkText: piece,
    normalizedChunkText: normalizeForSearch(piece),
    preview: buildPreview(piece, 220),
    createdAt: now(),
    updatedAt: now(),
  }));

  if (docs.length) {
    await chunksCollection.insertMany(docs);
  }

  return docs.length;
}

async function keywordSearchDocuments(query, category, limit = 10) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];

  const regex = new RegExp(escapeRegex(cleanQuery), "i");
  const filter = category ? { category } : {};
  const results = [];

  try {
    const textFilter = { ...filter, $text: { $search: cleanQuery } };

    const textResults = await documentsCollection
      .find(textFilter, {
        projection: {
          title: 1,
          category: 1,
          type: 1,
          fileId: 1,
          mimeType: 1,
          rawText: 1,
          summary: 1,
          createdAt: 1,
          score: { $meta: "textScore" },
        },
      })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit * 2)
      .toArray();

    for (const doc of textResults) {
      results.push({
        ...doc,
        searchMode: "keyword-text",
        relevanceScore: (doc.score || 0) * 10 + 20,
        preview: doc.summary || buildPreview(doc.rawText || ""),
      });
    }
  } catch (error) {
    // text index may not be ready
  }

  const regexResults = await documentsCollection
    .find(
      {
        ...filter,
        $or: [{ title: regex }, { rawText: regex }, { normalizedText: regex }],
      },
      {
        projection: {
          title: 1,
          category: 1,
          type: 1,
          fileId: 1,
          mimeType: 1,
          rawText: 1,
          summary: 1,
          createdAt: 1,
        },
      }
    )
    .limit(limit * 2)
    .toArray();

  for (const doc of regexResults) {
    const titleScore = computeKeywordScore(doc.title || "", cleanQuery) * 1.6;
    const textScore = computeKeywordScore(
      (doc.rawText || "").slice(0, 4000),
      cleanQuery
    );
    results.push({
      ...doc,
      searchMode: "keyword-regex",
      relevanceScore: titleScore + textScore + 25,
      preview: doc.summary || buildPreview(doc.rawText || ""),
    });
  }

  const deduped = new Map();

  for (const item of results) {
    const key = String(item._id);
    const previous = deduped.get(key);
    if (
      !previous ||
      (item.relevanceScore || 0) > (previous.relevanceScore || 0)
    ) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, limit);
}

async function searchChunks(query, category, limit = 10) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];

  const regex = new RegExp(escapeRegex(cleanQuery), "i");
  const filter = category ? { category } : {};

  const chunks = await chunksCollection
    .find(
      {
        ...filter,
        $or: [{ title: regex }, { chunkText: regex }, { normalizedChunkText: regex }],
      },
      {
        projection: {
          documentId: 1,
          title: 1,
          category: 1,
          chunkIndex: 1,
          chunkText: 1,
          preview: 1,
        },
      }
    )
    .limit(limit * 3)
    .toArray();

  return chunks
    .map((chunk) => ({
      ...chunk,
      relevanceScore:
        computeKeywordScore(chunk.title || "", cleanQuery) * 1.5 +
        computeKeywordScore(chunk.chunkText || "", cleanQuery) +
        10,
    }))
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, limit);
}

async function searchNotices(query, category, limit = 10) {
  const docs = await keywordSearchDocuments(query, category, limit);
  const chunks = await searchChunks(query, category, limit);

  const docMap = new Map();

  for (const doc of docs) {
    docMap.set(String(doc._id), {
      _id: doc._id,
      title: doc.title,
      category: doc.category,
      type: doc.type,
      fileId: doc.fileId,
      mimeType: doc.mimeType,
      preview: doc.preview || buildPreview(doc.rawText || ""),
      summary: doc.summary || buildPreview(doc.rawText || ""),
      matchedChunk: null,
      relevanceScore: doc.relevanceScore || 0,
      searchMode: doc.searchMode || "keyword",
      createdAt: doc.createdAt,
      hasFullText: Boolean(doc.rawText),
      fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
      fullNoticeUrl: `/api/student/notices/${doc._id}/full`,
    });
  }

  for (const chunk of chunks) {
    const docId = String(chunk.documentId);
    const existing = docMap.get(docId);

    if (existing) {
      existing.relevanceScore += Math.round((chunk.relevanceScore || 0) * 0.5);
      if (!existing.matchedChunk) {
        existing.matchedChunk = chunk.chunkText;
        existing.preview = chunk.preview || existing.preview;
      }
    } else {
      const doc = await documentsCollection.findOne(
        { _id: chunk.documentId },
        {
          projection: {
            title: 1,
            category: 1,
            type: 1,
            fileId: 1,
            mimeType: 1,
            rawText: 1,
            summary: 1,
            createdAt: 1,
          },
        }
      );

      if (doc) {
        docMap.set(docId, {
          _id: doc._id,
          title: doc.title,
          category: doc.category,
          type: doc.type,
          fileId: doc.fileId,
          mimeType: doc.mimeType,
          preview: chunk.preview || doc.summary || buildPreview(doc.rawText || ""),
          summary: doc.summary || buildPreview(doc.rawText || ""),
          matchedChunk: chunk.chunkText,
          relevanceScore: chunk.relevanceScore || 0,
          searchMode: "chunk-match",
          createdAt: doc.createdAt,
          hasFullText: Boolean(doc.rawText),
          fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
          fullNoticeUrl: `/api/student/notices/${doc._id}/full`,
        });
      }
    }
  }

  return Array.from(docMap.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, limit);
}

async function getConversationMemory(userId, limit = 4) {
  if (!userId) return [];

  return await chatLogsCollection
    .find({ userId, mode: { $in: ["answer", "full_notice", "summary"] } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

function buildConversationMemoryText(memory = []) {
  if (!memory.length) return "";

  return memory
    .reverse()
    .map((item, index) => {
      const sources = (item.sources || [])
        .map((s) => s.title)
        .filter(Boolean)
        .join(", ");

      return [
        `Conversation item ${index + 1}:`,
        `User asked: ${item.query || ""}`,
        `Assistant answered: ${item.answer || ""}`,
        sources ? `Related notices: ${sources}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n-----------------\n\n");
}

async function getTopContextChunks(searchResults, question, maxChunks = 8) {
  const docIds = searchResults
    .slice(0, 5)
    .map((item) => safeObjectId(item._id))
    .filter(Boolean);

  if (!docIds.length) return [];

  const chunks = await chunksCollection
    .find(
      { documentId: { $in: docIds } },
      {
        projection: {
          documentId: 1,
          title: 1,
          category: 1,
          chunkIndex: 1,
          chunkText: 1,
          preview: 1,
        },
      }
    )
    .toArray();

  const scored = chunks.map((chunk) => ({
    ...chunk,
    score:
      computeKeywordScore(chunk.title || "", question) * 1.5 +
      computeKeywordScore(chunk.chunkText || "", question) +
      (chunk.chunkIndex === 0 ? 5 : 0),
  }));

  return scored
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxChunks);
}

function buildCitationsFromChunks(chunks = []) {
  return chunks.slice(0, 4).map((chunk, index) => ({
    id: index + 1,
    title: chunk.title,
    category: chunk.category,
    excerpt: buildPreview(chunk.chunkText || "", 220),
    chunkIndex: chunk.chunkIndex,
  }));
}

function safeJsonParse(text = "") {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function makeFallbackAnswer({
  question,
  searchResults = [],
  contextChunks = [],
  language = "en",
}) {
  const best = searchResults[0];
  const bestChunk = contextChunks[0];

  if (!best) {
    return {
      answer:
        language === "bn"
          ? "আমি আপলোড করা নোটিশগুলোর মধ্যে মিলযুক্ত তথ্য খুঁজে পাইনি।"
          : "I could not find a matching answer in the uploaded notices.",
      confidence: "low",
      citations: [],
    };
  }

  const answer =
    language === "bn"
      ? `আমি সবচেয়ে কাছের নোটিশ হিসেবে "${best.title}" পেয়েছি। ${
          bestChunk?.chunkText
            ? buildPreview(bestChunk.chunkText, 260)
            : "প্রাসঙ্গিক তথ্য পাওয়া গেছে, তবে সুনির্দিষ্ট উত্তরের জন্য পুরো নোটিশ খুলে দেখুন।"
        }`
      : `I found the closest notice as "${best.title}". ${
          bestChunk?.chunkText
            ? buildPreview(bestChunk.chunkText, 260)
            : "Relevant information exists, but for a precise answer please open the full notice."
        }`;

  return {
    answer,
    confidence: "medium",
    citations: buildCitationsFromChunks(contextChunks),
  };
}

async function answerQuestionFromContext(question, searchResults, userId = null) {
  const language = detectLanguage(question);
  const contextChunks = await getTopContextChunks(searchResults, question, 8);
  const memory = await getConversationMemory(userId, 4);
  const memoryText = buildConversationMemoryText(memory);

  const contextBlocks = contextChunks.map(
    (chunk, idx) =>
      `Source ${idx + 1}
Title: ${chunk.title}
Category: ${chunk.category}
Chunk Index: ${chunk.chunkIndex}
Content:
${chunk.chunkText}`
  );

  const combinedContext = contextBlocks.join("\n\n====================\n\n");

  if (!combinedContext.trim()) {
    return makeFallbackAnswer({
      question,
      searchResults,
      contextChunks,
      language,
    });
  }

  const systemPrompt = `
You are a university department notice assistant.

Your job:
- Answer ONLY from the provided notice context.
- Be accurate, grounded, and helpful.
- Understand natural language questions like a real chatbot, but never invent facts.
- If the exact answer is not present, say so clearly.
- Use the same language as the user's question.
- Prefer the most specific date, deadline, time, exam, routine, admission, result, scholarship, or official instruction found in the sources.
- If multiple notices conflict, prefer the most relevant source to the question and mention uncertainty briefly.
- Keep answers concise but complete.
- Return JSON only in this shape:
{
  "answer": "final answer",
  "confidence": "high|medium|low",
  "citations": [
    {
      "sourceNumber": 1,
      "reason": "why this source supports the answer"
    }
  ]
}
Do not include markdown fences.
`.trim();

  const userPrompt = `
User question:
${question}

Recent conversation memory:
${memoryText || "No previous conversation memory."}

Available notice context:
${combinedContext}
`.trim();

  try {
    const raw = await askOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.1,
        maxTokens: 500,
        responseFormat: { type: "json_object" },
      }
    );

    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      return makeFallbackAnswer({
        question,
        searchResults,
        contextChunks,
        language,
      });
    }

    const citations = Array.isArray(parsed.citations)
      ? parsed.citations
          .map((item) => {
            const sourceNumber = Number(item?.sourceNumber);
            if (!sourceNumber || !contextChunks[sourceNumber - 1]) return null;
            const chunk = contextChunks[sourceNumber - 1];
            return {
              sourceNumber,
              title: chunk.title,
              category: chunk.category,
              excerpt: buildPreview(chunk.chunkText || "", 220),
              chunkIndex: chunk.chunkIndex,
              reason: normalizeText(item?.reason || ""),
            };
          })
          .filter(Boolean)
      : [];

    return {
      answer: normalizeText(parsed.answer || "") || "I could not generate an answer.",
      confidence: ["high", "medium", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "medium",
      citations,
    };
  } catch (error) {
    return makeFallbackAnswer({
      question,
      searchResults,
      contextChunks,
      language,
    });
  }
}

async function getFullNoticePayload(documentId) {
  const _id = safeObjectId(documentId);
  if (!_id) return null;

  const doc = await documentsCollection.findOne({ _id });
  if (!doc) return null;

  return {
    _id: doc._id,
    title: doc.title,
    category: doc.category,
    type: doc.type,
    mimeType: doc.mimeType,
    summary: doc.summary,
    fullText: doc.rawText,
    fileId: doc.fileId,
    fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
    originalFileName: doc.originalFileName || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function buildSourcesFromResults(results = []) {
  return results.slice(0, 3).map((item) => ({
    noticeId: item._id,
    title: item.title,
    category: item.category,
    fileUrl: item.fileUrl,
    fullNoticeUrl: item.fullNoticeUrl,
  }));
}

async function seedAdminIfEmpty() {
  const count = await adminCollection.countDocuments();
  if (count === 0) {
    await adminCollection.insertOne({
      name: "Default Admin",
      email: "admin@example.com",
      createdAt: now(),
    });
  }
}

async function ensureIndexes() {
  try {
    await usersCollection.createIndex(
      { email: 1 },
      { unique: true, sparse: true }
    );
  } catch (error) {
    console.log("users email index skipped:", error.message);
  }

  try {
    await documentsCollection.createIndex({
      title: "text",
      normalizedText: "text",
      category: "text",
      summary: "text",
    });
  } catch (error) {
    console.log("documents text index skipped:", error.message);
  }

  try {
    await documentsCollection.createIndex({ createdAt: -1 });
    await documentsCollection.createIndex({ category: 1, createdAt: -1 });
    await documentsCollection.createIndex({ title: 1 });
    await chunksCollection.createIndex({ documentId: 1 });
    await chunksCollection.createIndex({ category: 1 });
    await chunksCollection.createIndex({ title: "text", chunkText: "text" });
    await chatLogsCollection.createIndex({ userId: 1, createdAt: -1 });
    await feedbackCollection.createIndex({ chatLogId: 1 });
  } catch (error) {
    console.log("regular index creation warning:", error.message);
  }
}

app.get("/", (req, res) => {
  res.send("🚀 Server is running...");
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API test ok",
    file: __filename,
    time: new Date().toISOString(),
  });
});

app.get("/api/routes", (req, res) => {
  res.json({
    success: true,
    routes: listRoutes(),
    file: __filename,
  });
});

app.get("/users", async (req, res) => {
  try {
    const result = await usersCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/users", async (req, res) => {
  try {
    const user = {
      ...req.body,
      createdAt: now(),
    };
    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/api/admin/notices", upload.single("file"), async (req, res) => {
  let storedFileId = null;

  try {
    const title = normalizeText(req.body.title || req.body.headline || "");
    const category = normalizeText(req.body.category || "general") || "general";
    const textContent =
      req.body.textContent || req.body.noticeText || req.body.content || "";
    const uploadedBy = req.body.uploadedBy || "admin";

    if (!title) {
      return res.status(400).json({ message: "title or headline is required" });
    }

    if (!req.file && !normalizeText(textContent)) {
      return res.status(400).json({
        message: "Provide either a file or textContent/noticeText/content",
      });
    }

    const extraction = await extractTextFromUploadedInput({
      file: req.file,
      textContent,
      title,
    });

    storedFileId = extraction.fileId;

    if (!extraction.extractedText) {
      return res.status(400).json({
        message:
          "Could not extract any usable text from the uploaded input. For scanned PDFs, upload the text or an image version.",
      });
    }

    const summary = await generateSummary(extraction.extractedText, title);

    const document = {
      title,
      category,
      type: extraction.sourceType,
      mimeType: extraction.mimeType,
      originalFileName: extraction.originalFileName,
      fileId: extraction.fileId,
      rawText: extraction.extractedText,
      normalizedText: normalizeForSearch(extraction.extractedText),
      summary,
      uploadedBy,
      status: "processing",
      createdAt: now(),
      updatedAt: now(),
    };

    const insertResult = await documentsCollection.insertOne(document);

    const insertedDocument = {
      ...document,
      _id: insertResult.insertedId,
    };

    const chunkCount = await rebuildChunksForDocument(insertedDocument);

    await documentsCollection.updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          status: "ready",
          chunkCount,
          updatedAt: now(),
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "Notice uploaded and indexed successfully",
      notice: {
        _id: insertResult.insertedId,
        title,
        category,
        type: extraction.sourceType,
        summary,
        fileId: extraction.fileId,
        fileUrl: extraction.fileId ? `/api/files/${extraction.fileId}` : null,
        chunkCount,
        status: "ready",
      },
    });
  } catch (error) {
    if (storedFileId) {
      await deleteGridFSFile(storedFileId);
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/admin/notices", async (req, res) => {
  try {
    const category = req.query.category;
    const filter = category ? { category } : {};

    const notices = await documentsCollection
      .find(filter, {
        projection: {
          title: 1,
          category: 1,
          type: 1,
          mimeType: 1,
          originalFileName: 1,
          fileId: 1,
          summary: 1,
          status: 1,
          chunkCount: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, notices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/admin/notices/:id", async (req, res) => {
  try {
    const payload = await getFullNoticePayload(req.params.id);
    if (!payload) {
      return res.status(404).json({ message: "Notice not found" });
    }
    res.json({ success: true, notice: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/admin/notices/:id", async (req, res) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) {
      return res.status(400).json({ message: "Invalid notice id" });
    }

    const existing = await documentsCollection.findOne({ _id });
    if (!existing) {
      return res.status(404).json({ message: "Notice not found" });
    }

    const updateFields = {
      updatedAt: now(),
    };

    if (req.body.title) updateFields.title = normalizeText(req.body.title);
    if (req.body.category) updateFields.category = normalizeText(req.body.category);

    let mustReindex = false;

    if (typeof req.body.textContent === "string") {
      const clean = normalizeText(req.body.textContent);
      updateFields.rawText = clean;
      updateFields.normalizedText = normalizeForSearch(clean);
      updateFields.summary = await generateSummary(
        clean,
        updateFields.title || existing.title
      );
      mustReindex = true;
    }

    await documentsCollection.updateOne({ _id }, { $set: updateFields });

    if (mustReindex) {
      const refreshed = await documentsCollection.findOne({ _id });
      const chunkCount = await rebuildChunksForDocument(refreshed);

      await documentsCollection.updateOne(
        { _id },
        {
          $set: {
            chunkCount,
            status: "ready",
            updatedAt: now(),
          },
        }
      );
    }

    const updated = await getFullNoticePayload(_id);
    res.json({ success: true, notice: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/admin/notices/:id/reindex", async (req, res) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) {
      return res.status(400).json({ message: "Invalid notice id" });
    }

    const doc = await documentsCollection.findOne({ _id });
    if (!doc) {
      return res.status(404).json({ message: "Notice not found" });
    }

    const chunkCount = await rebuildChunksForDocument(doc);

    await documentsCollection.updateOne(
      { _id },
      {
        $set: {
          chunkCount,
          status: "ready",
          updatedAt: now(),
        },
      }
    );

    res.json({
      success: true,
      message: "Reindex completed",
      chunkCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/notices/:id", async (req, res) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) {
      return res.status(400).json({ message: "Invalid notice id" });
    }

    const existing = await documentsCollection.findOne({ _id });
    if (!existing) {
      return res.status(404).json({ message: "Notice not found" });
    }

    await chunksCollection.deleteMany({ documentId: _id });
    await documentsCollection.deleteOne({ _id });
    await deleteGridFSFile(existing.fileId);

    res.json({ success: true, message: "Notice deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/files/:fileId", async (req, res) => {
  try {
    const fileId = safeObjectId(req.params.fileId);
    if (!fileId) {
      return res.status(400).json({ message: "Invalid file id" });
    }

    const fileDoc = await db.collection("uploads.files").findOne({ _id: fileId });
    if (!fileDoc) {
      return res.status(404).json({ message: "File not found" });
    }

    res.set("Content-Type", fileDoc.contentType || "application/octet-stream");
    res.set(
      "Content-Disposition",
      `inline; filename="${fileDoc.filename || "file"}"`
    );

    bucket.openDownloadStream(fileId).pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/student/search", async (req, res) => {
  try {
    const query = req.query.query || "";
    const category = req.query.category || "";
    const limit = Math.min(Number(req.query.limit || 10), 20);

    if (!normalizeText(query)) {
      return res.status(400).json({ message: "query is required" });
    }

    const results = await searchNotices(query, category, limit);

    res.json({
      success: true,
      total: results.length,
      results,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/student/notices/:id/full", async (req, res) => {
  try {
    const payload = await getFullNoticePayload(req.params.id);
    if (!payload) {
      return res.status(404).json({ message: "Notice not found" });
    }

    res.json({
      success: true,
      mode: "full_notice",
      notice: payload,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/student/query", async (req, res) => {
  try {
    const query = normalizeText(req.body.query || req.body.question || "");
    const category = normalizeText(req.body.category || "");
    const userId = req.body.userId || null;

    if (!query) {
      return res.status(400).json({ message: "query/question is required" });
    }

    if (isGreetingIntent(query)) {
      const greeting =
        detectLanguage(query) === "bn"
          ? "হ্যালো। আপনি নোটিশ, রুটিন, পরীক্ষা, ফলাফল, ভর্তি, বা স্কলারশিপ সম্পর্কে প্রশ্ন করতে পারেন।"
          : "Hello. You can ask me about notices, routines, exams, results, admission, or scholarship information.";

      const chatLog = await chatLogsCollection.insertOne({
        userId,
        query,
        answer: greeting,
        sources: [],
        citations: [],
        confidence: "high",
        mode: "greeting",
        createdAt: now(),
      });

      return res.json({
        success: true,
        mode: "greeting",
        answer: greeting,
        confidence: "high",
        citations: [],
        sources: [],
        chatLogId: chatLog.insertedId,
      });
    }

    const results = await searchNotices(query, category, 5);

    if (!results.length) {
      const answer =
        detectLanguage(query) === "bn"
          ? "আমি আপলোড করা নোটিশগুলোর মধ্যে মিলযুক্ত তথ্য খুঁজে পাইনি।"
          : "I could not find any matching notice in the uploaded documents.";

      const chatLog = await chatLogsCollection.insertOne({
        userId,
        query,
        answer,
        sources: [],
        citations: [],
        confidence: "low",
        mode: "no_result",
        createdAt: now(),
      });

      return res.json({
        success: true,
        mode: "no_result",
        answer,
        confidence: "low",
        citations: [],
        sources: [],
        chatLogId: chatLog.insertedId,
      });
    }

    if (isFullNoticeIntent(query)) {
      const fullNotice = await getFullNoticePayload(results[0]._id);

      const chatLog = await chatLogsCollection.insertOne({
        userId,
        query,
        answer: "Full notice returned",
        sources: [
          {
            noticeId: fullNotice._id,
            title: fullNotice.title,
            category: fullNotice.category,
            fileUrl: fullNotice.fileUrl,
            fullNoticeUrl: `/api/student/notices/${fullNotice._id}/full`,
          },
        ],
        citations: [],
        confidence: "high",
        mode: "full_notice",
        createdAt: now(),
      });

      return res.json({
        success: true,
        mode: "full_notice",
        notice: fullNotice,
        confidence: "high",
        citations: [],
        sources: [
          {
            noticeId: fullNotice._id,
            title: fullNotice.title,
            category: fullNotice.category,
            fileUrl: fullNotice.fileUrl,
            fullNoticeUrl: `/api/student/notices/${fullNotice._id}/full`,
          },
        ],
        chatLogId: chatLog.insertedId,
      });
    }

    if (isSummaryIntent(query)) {
      const bestNotice = await getFullNoticePayload(results[0]._id);
      const answer =
        bestNotice?.summary ||
        (detectLanguage(query) === "bn"
          ? "সারাংশ তৈরি করা যায়নি।"
          : "Summary could not be generated.");

      const sources = buildSourcesFromResults(results);
      const chatLog = await chatLogsCollection.insertOne({
        userId,
        query,
        answer,
        sources,
        citations: [],
        confidence: "high",
        mode: "summary",
        createdAt: now(),
      });

      return res.json({
        success: true,
        mode: "summary",
        answer,
        confidence: "high",
        citations: [],
        sources,
        matchedResults: results,
        chatLogId: chatLog.insertedId,
      });
    }

    const aiResult = await answerQuestionFromContext(query, results, userId);
    const sources = buildSourcesFromResults(results);

    const chatLog = await chatLogsCollection.insertOne({
      userId,
      query,
      answer: aiResult.answer,
      sources,
      citations: aiResult.citations || [],
      confidence: aiResult.confidence || "medium",
      mode: "answer",
      createdAt: now(),
    });

    res.json({
      success: true,
      mode: "answer",
      answer: aiResult.answer,
      confidence: aiResult.confidence || "medium",
      citations: aiResult.citations || [],
      sources,
      matchedResults: results,
      chatLogId: chatLog.insertedId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/ai/ask", async (req, res) => {
  try {
    const question = normalizeText(req.body.question || "");
    const category = normalizeText(req.body.category || "");
    const userId = req.body.userId || null;

    if (!question) {
      return res.status(400).json({ message: "question is required" });
    }

    const results = await searchNotices(question, category, 5);

    if (!results.length) {
      const answer =
        detectLanguage(question) === "bn"
          ? "আমি আপলোড করা নোটিশগুলোর মধ্যে মিলযুক্ত তথ্য খুঁজে পাইনি।"
          : "I could not find any matching notice in the uploaded documents.";

      const chatLog = await chatLogsCollection.insertOne({
        userId,
        query: question,
        answer,
        sources: [],
        citations: [],
        confidence: "low",
        mode: "no_result",
        createdAt: now(),
      });

      return res.json({
        success: true,
        answer,
        confidence: "low",
        citations: [],
        sources: [],
        matchedResults: [],
        chatLogId: chatLog.insertedId,
      });
    }

    const aiResult = await answerQuestionFromContext(question, results, userId);
    const sources = buildSourcesFromResults(results);

    const chatLog = await chatLogsCollection.insertOne({
      userId,
      query: question,
      answer: aiResult.answer,
      sources,
      citations: aiResult.citations || [],
      confidence: aiResult.confidence || "medium",
      mode: "answer",
      createdAt: now(),
    });

    res.json({
      success: true,
      answer: aiResult.answer,
      confidence: aiResult.confidence || "medium",
      citations: aiResult.citations || [],
      sources,
      matchedResults: results,
      chatLogId: chatLog.insertedId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const chatLogId = safeObjectId(req.body.chatLogId);
    const type = req.body.type;
    const comment = req.body.comment || "";

    if (!chatLogId || !type) {
      return res
        .status(400)
        .json({ message: "chatLogId and type are required" });
    }

    const result = await feedbackCollection.insertOne({
      chatLogId,
      type,
      comment,
      createdAt: now(),
    });

    res.json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  next();
});

async function bootstrap() {
  await client.connect();

  db = client.db(dbName);
  bucket = new GridFSBucket(db, { bucketName: "uploads" });

  usersCollection = db.collection("users");
  adminCollection = db.collection("admin");
  documentsCollection = db.collection("documents");
  chunksCollection = db.collection("chunks");
  chatLogsCollection = db.collection("chatLogs");
  feedbackCollection = db.collection("feedback");

  await ensureIndexes();
  await seedAdminIfEmpty();
  await db.command({ ping: 1 });

  console.log("✅ MongoDB connected");
  console.log("📄 Running file:", __filename);
  console.log("🛣️ Routes:", listRoutes());
}

// bootstrap()
//   .then(() => {
//     app.listen(port, () => {
//       console.log(`🚀 Server running on port ${port}`);
//     });
//   })
//   .catch((error) => {
//     console.error("❌ MongoDB Error:", error.message);
//     process.exit(1);
//   });

// ==========================
// 🚀 RAILWAY START (FIXED)
// ==========================


let isConnected = false;

async function startServer() {
  try {
    if (!isConnected) {
      await client.connect();

      db = client.db(dbName);
      bucket = new GridFSBucket(db, { bucketName: "uploads" });

      usersCollection = db.collection("users");
      adminCollection = db.collection("admin");
      documentsCollection = db.collection("documents");
      chunksCollection = db.collection("chunks");
      chatLogsCollection = db.collection("chatLogs");
      feedbackCollection = db.collection("feedback");

      await ensureIndexes();
      await seedAdminIfEmpty();
      await db.command({ ping: 1 });

      isConnected = true;

      console.log("✅ MongoDB connected");
    }

    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });

  } catch (error) {
    console.error("❌ Startup Error:", error);
    process.exit(1);
  }
}

startServer();