import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { validate } from '../../../middleware/validate.middleware';
import { authenticate } from '../../../middleware/auth.middleware';
import { requireStaff } from '../../../middleware/role.middleware';
import { QuestionSetModel } from '../../../database/models/QuestionSet.model';
import { QuestionModel } from '../../../database/models/Question.model';
import { canManageDocument, visibleContentFilter } from '../../../utils/academic-scope';
import notificationService from '../../../services/notification.service';
import { questionPayload } from '../questions/questions.routes';

const router = Router();
router.use(authenticate);

const setInputSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional(),
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(1).max(100),
  items: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        marks: z.coerce.number().min(0).max(1000).optional().nullable(),
      })
    )
    .min(1)
    .max(200),
  visibility: z.enum(['school', 'private', 'global']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const updateSetSchema = setInputSchema.partial();

const listQuerySchema = z.object({
  classLevel: z.coerce.number().int().min(1).max(10).optional(),
  subject: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

async function resolveItems(items: Array<{ question: string; marks?: number | null }>) {
  const ids = items.map((item) => item.question).filter((id) => Types.ObjectId.isValid(id));
  const questions = await QuestionModel.find({ _id: { $in: ids } }).select('_id marks').lean();
  const marksById = new Map(questions.map((question) => [String(question._id), question.marks ?? 1]));
  const resolved = items
    .filter((item) => marksById.has(item.question))
    .map((item) => ({
      question: new Types.ObjectId(item.question),
      marks: item.marks ?? marksById.get(item.question) ?? 1,
    }));
  return {
    items: resolved,
    totalMarks: resolved.reduce((sum, item) => sum + (item.marks || 0), 0),
    questionCount: resolved.length,
  };
}

function setPayload(set: Record<string, unknown>, options: { includeQuestions?: boolean } = {}) {
  return {
    _id: String(set._id),
    schoolId: set.schoolId ? String(set.schoolId) : null,
    createdBy: String(set.createdBy || ''),
    createdByRole: set.createdByRole || '',
    name: set.name,
    description: set.description || '',
    classLevel: set.classLevel,
    subject: set.subject,
    items: set.items || [],
    totalMarks: set.totalMarks || 0,
    questionCount: set.questionCount || 0,
    visibility: set.visibility,
    status: set.status,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
  };
}

router.get(
  '/',
  requireStaff,
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const filters: Record<string, unknown>[] = [visibleContentFilter(req)];
    if (query.classLevel) filters.push({ classLevel: query.classLevel });
    if (query.subject) filters.push({ subject: query.subject });
    if (query.search) filters.push({ name: { $regex: query.search, $options: 'i' } });
    const where = filters.length === 1 ? filters[0] : { $and: filters };

    const [sets, total] = await Promise.all([
      QuestionSetModel.find(where)
        .sort({ updatedAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      QuestionSetModel.countDocuments(where),
    ]);
    ok(res, {
      sets: sets.map((set) => setPayload(set as unknown as Record<string, unknown>)),
      total,
      page: query.page,
      limit: query.limit,
    });
  })
);

router.get(
  '/:id',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const set = await QuestionSetModel.findById(req.params.id).lean();
    if (!set) return fail(res, 404, 'Question set not found');
    const allowed = await QuestionSetModel.exists({ _id: set._id, ...visibleContentFilter(req) });
    if (!allowed) return fail(res, 403, 'You cannot view this question set');

    const ordered = (set.items || []).map((item) => String(item.question));
    const questions = await QuestionModel.find({ _id: { $in: ordered } }).lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));
    const hydrated = (set.items || [])
      .map((item) => {
        const question = byId.get(String(item.question));
        return question
          ? {
              marks: item.marks ?? question.marks ?? 1,
              question: questionPayload(question as unknown as Record<string, unknown>),
            }
          : null;
      })
      .filter(Boolean);

    ok(res, { set: setPayload(set as unknown as Record<string, unknown>), questions: hydrated });
  })
);

router.post(
  '/',
  requireStaff,
  validate(setInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof setInputSchema>;
    const resolved = await resolveItems(input.items);
    if (!resolved.items.length) return fail(res, 400, 'None of the selected questions could be found');

    const set = await QuestionSetModel.create({
      schoolId: req.user!.schoolId || null,
      createdBy: req.user!.id,
      createdByRole: req.user!.role,
      name: input.name,
      description: input.description || '',
      classLevel: input.classLevel,
      subject: input.subject,
      visibility: input.visibility || 'school',
      status: input.status || 'published',
      ...resolved,
    });

    if (req.user!.schoolId) {
      await notificationService.notifySchoolRoles(
        req.user!.schoolId,
        ['teacher', 'school_admin'],
        {
          type: 'question_set',
          title: 'New question set created',
          message: `${req.user!.name} created "${input.name}" for Class ${input.classLevel} ${input.subject}.`,
          link: '/question-sets',
        },
        { actorId: req.user!.id }
      );
    }

    res.status(201).json({
      success: true,
      set: setPayload(set.toObject() as unknown as Record<string, unknown>),
    });
  })
);

router.patch(
  '/:id',
  requireStaff,
  validate(updateSetSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const set = await QuestionSetModel.findById(req.params.id);
    if (!set) return fail(res, 404, 'Question set not found');
    if (!canManageDocument(req, set)) return fail(res, 403, 'You cannot edit this question set');

    if (req.body.name !== undefined) set.name = req.body.name;
    if (req.body.description !== undefined) set.description = req.body.description;
    if (req.body.classLevel !== undefined) set.classLevel = req.body.classLevel;
    if (req.body.subject !== undefined) set.subject = req.body.subject;
    if (req.body.visibility !== undefined) set.visibility = req.body.visibility;
    if (req.body.status !== undefined) set.status = req.body.status;
    if (req.body.items !== undefined) {
      const resolved = await resolveItems(req.body.items);
      if (!resolved.items.length) return fail(res, 400, 'None of the selected questions could be found');
      set.items = resolved.items as never;
      set.totalMarks = resolved.totalMarks;
      set.questionCount = resolved.questionCount;
    }
    await set.save();
    ok(res, { set: setPayload(set.toObject() as unknown as Record<string, unknown>) });
  })
);

router.post(
  '/:id/duplicate',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const set = await QuestionSetModel.findById(req.params.id).lean();
    if (!set) return fail(res, 404, 'Question set not found');
    if (!canManageDocument(req, set)) return fail(res, 403, 'You cannot copy this question set');
    const copy = await QuestionSetModel.create({
      schoolId: req.user!.schoolId || null,
      createdBy: req.user!.id,
      createdByRole: req.user!.role,
      name: `${set.name} (copy)`,
      description: set.description,
      classLevel: set.classLevel,
      subject: set.subject,
      items: set.items,
      totalMarks: set.totalMarks,
      questionCount: set.questionCount,
      visibility: set.visibility,
      status: 'draft',
    });
    res.status(201).json({ success: true, set: setPayload(copy.toObject() as unknown as Record<string, unknown>) });
  })
);

router.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const set = await QuestionSetModel.findById(req.params.id);
    if (!set) return fail(res, 404, 'Question set not found');
    if (!canManageDocument(req, set)) return fail(res, 403, 'You cannot delete this question set');
    await QuestionSetModel.deleteOne({ _id: set._id });
    ok(res, { message: 'Question set deleted' });
  })
);

export default router;
