import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { validate } from '../../../middleware/validate.middleware';
import { authenticate } from '../../../middleware/auth.middleware';
import { requireStaff } from '../../../middleware/role.middleware';
import { uploadMaterialFile } from '../../../middleware/upload.middleware';
import { StudyMaterialModel } from '../../../database/models/StudyMaterial.model';
import { deleteGridFSFile, findFile, streamFile, uploadBuffer } from '../../../config/gridfs';
import { canManageDocument, studentVisibleFilter, visibleContentFilter } from '../../../utils/academic-scope';
import notificationService from '../../../services/notification.service';

const router = Router();
router.use(authenticate);

const createMaterialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).optional(),
  type: z.enum(['note', 'exam_sheet', 'syllabus', 'worksheet', 'other']).default('note'),
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(1).max(100),
  chapter: z.string().trim().max(160).optional(),
  externalUrl: z.string().trim().max(1000).optional(),
  textContent: z.string().max(200000).optional(),
  visibility: z.enum(['school', 'class', 'global']).optional(),
  isPublished: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value === 'true' : value)),
});

const updateMaterialSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(3000).optional(),
  type: z.enum(['note', 'exam_sheet', 'syllabus', 'worksheet', 'other']).optional(),
  classLevel: z.coerce.number().int().min(1).max(10).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  chapter: z.string().trim().max(160).optional(),
  externalUrl: z.string().trim().max(1000).optional(),
  textContent: z.string().max(200000).optional(),
  visibility: z.enum(['school', 'class', 'global']).optional(),
  isPublished: z.boolean().optional(),
});

function materialPayload(material: Record<string, unknown>) {
  return {
    _id: String(material._id),
    schoolId: material.schoolId ? String(material.schoolId) : null,
    createdBy: String(material.createdBy || ''),
    createdByName: material.createdByName || '',
    createdByRole: material.createdByRole || '',
    title: material.title,
    description: material.description || '',
    type: material.type,
    classLevel: material.classLevel,
    subject: material.subject,
    chapter: material.chapter || '',
    fileName: material.fileName || '',
    fileType: material.fileType || '',
    fileSize: material.fileSize || 0,
    hasFile: Boolean(material.fileId),
    externalUrl: material.externalUrl || '',
    textContent: material.textContent || '',
    visibility: material.visibility,
    isPublished: material.isPublished,
    downloadCount: material.downloadCount || 0,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { classLevel, subject, type, search, mine } = req.query as Record<string, string>;
    const student = !['teacher', 'school_admin', 'admin', 'superadmin'].includes(req.user!.role);
    const filters: Record<string, unknown>[] = [
      student ? studentVisibleFilter(req) : { ...visibleContentFilter(req), isPublished: true },
    ];
    if (classLevel) filters.push({ classLevel: Number(classLevel) });
    if (subject) filters.push({ subject });
    if (type && type !== 'all') filters.push({ type });
    if (mine === 'true') filters.push({ createdBy: new Types.ObjectId(req.user!.id) });
    if (search) filters.push({ title: { $regex: search, $options: 'i' } });
    const where = filters.length === 1 ? filters[0] : { $and: filters };

    const materials = await StudyMaterialModel.find(where).sort({ createdAt: -1 }).limit(200).lean();
    ok(res, {
      materials: materials.map((material) => materialPayload(material as unknown as Record<string, unknown>)),
    });
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response) => {
    const material = await StudyMaterialModel.findById(req.params.id).lean();
    if (!material) return fail(res, 404, 'Material not found');

    const staff = ['teacher', 'school_admin', 'admin', 'superadmin'].includes(req.user!.role);
    if (!staff) {
      if (!material.isPublished) return fail(res, 403, 'This material is not available');
      if (material.classLevel !== req.user!.classLevel) return fail(res, 403, 'This material is for another class');
      if (material.schoolId && String(material.schoolId) !== req.user!.schoolId) {
        return fail(res, 403, 'This material belongs to another school');
      }
    }

    if (!material.fileId) return fail(res, 404, 'This material has no downloadable file');
    const info = await findFile(material.fileId as string);
    if (!info) return fail(res, 404, 'File not found in storage');

    await StudyMaterialModel.updateOne({ _id: material._id }, { $inc: { downloadCount: 1 } });
    res.setHeader('Content-Type', info.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(info.filename)}"`);
    await streamFile(res, info._id);
    return undefined;
  })
);

router.post(
  '/',
  requireStaff,
  uploadMaterialFile.single('file'),
  validate(createMaterialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof createMaterialSchema>;
    if (!req.file && !input.externalUrl && !input.textContent) {
      return fail(res, 400, 'Upload a file, add an external link, or write the note content');
    }

    let fileId: string | null = null;
    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, `${Date.now()}-${req.file.originalname}`, req.file.mimetype, {
        title: input.title,
        kind: 'material',
        schoolId: req.user!.schoolId || null,
      });
      fileId = String(uploaded);
    }

    const material = await StudyMaterialModel.create({
      schoolId: req.user!.schoolId || null,
      createdBy: req.user!.id,
      createdByName: req.user!.name,
      createdByRole: req.user!.role,
      title: input.title,
      description: input.description || '',
      type: input.type,
      classLevel: input.classLevel,
      subject: input.subject,
      chapter: input.chapter || '',
      externalUrl: input.externalUrl || '',
      textContent: input.textContent || '',
      visibility: input.visibility || (req.user!.schoolId ? 'school' : 'global'),
      isPublished: input.isPublished !== false,
      fileId,
      fileName: req.file?.originalname || '',
      fileType: req.file?.mimetype || '',
      fileSize: req.file?.size || 0,
    });

    const payload = {
      type: 'material' as const,
      title: `New ${input.type.replace(/_/g, ' ')}: ${input.title}`,
      message: `${req.user!.name} added Class ${input.classLevel} ${input.subject} material.`,
      link: '/student/materials',
      schoolId: req.user!.schoolId || null,
    };
    await notificationService.notifyClassStudents(req.user!.schoolId || null, input.classLevel, payload, {
      actorId: req.user!.id,
    });
    if (req.user!.schoolId) {
      await notificationService.notifySchoolRoles(req.user!.schoolId, ['teacher', 'school_admin'], {
        ...payload,
        link: '/materials',
      }, { actorId: req.user!.id });
    }

    res.status(201).json({
      success: true,
      material: materialPayload(material.toObject() as unknown as Record<string, unknown>),
    });
  })
);

router.patch(
  '/:id',
  requireStaff,
  validate(updateMaterialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const material = await StudyMaterialModel.findById(req.params.id);
    if (!material) return fail(res, 404, 'Material not found');
    if (!canManageDocument(req, material)) return fail(res, 403, 'You cannot edit this material');
    for (const key of ['title', 'description', 'type', 'classLevel', 'subject', 'chapter', 'externalUrl', 'textContent', 'visibility', 'isPublished'] as const) {
      if (req.body[key] !== undefined) (material as unknown as Record<string, unknown>)[key] = req.body[key];
    }
    await material.save();
    ok(res, { material: materialPayload(material.toObject() as unknown as Record<string, unknown>) });
  })
);

router.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const material = await StudyMaterialModel.findById(req.params.id);
    if (!material) return fail(res, 404, 'Material not found');
    if (!canManageDocument(req, material)) return fail(res, 403, 'You cannot delete this material');
    if (material.fileId) await deleteGridFSFile(material.fileId as string);
    await StudyMaterialModel.deleteOne({ _id: material._id });
    ok(res, { message: 'Material deleted' });
  })
);

export default router;
