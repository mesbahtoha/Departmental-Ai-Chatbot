import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { validate } from '../../../middleware/validate.middleware';
import { authenticate } from '../../../middleware/auth.middleware';
import { requireStaff } from '../../../middleware/role.middleware';
import { QuestionModel } from '../../../database/models/Question.model';
import { QuestionSetModel } from '../../../database/models/QuestionSet.model';
import { QUESTION_TYPE_KEYS, QUESTION_TYPES } from '../../../constants/academic';
import { canManageDocument, visibleContentFilter } from '../../../utils/academic-scope';
import notificationService from '../../../services/notification.service';

const router = Router();
router.use(authenticate);

const optionSchema = z.object({
  key: z.string().trim().min(1).max(10),
  text: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
});

const pairSchema = z.object({
  left: z.string().trim().max(2000).optional(),
  right: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
});

const blankSchema = z.object({
  index: z.coerce.number().int().min(0).optional(),
  answer: z.string().trim().max(1000).optional(),
  clue: z.string().trim().max(1000).optional(),
});

const labelSchema = z.object({
  label: z.string().trim().max(200).optional(),
  answer: z.string().trim().max(1000).optional(),
  x: z.coerce.number().optional().nullable(),
  y: z.coerce.number().optional().nullable(),
});

export const questionInputSchema = z.object({
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(1).max(100),
  chapter: z.string().trim().max(160).optional(),
  topic: z.string().trim().max(160).optional(),
  type: z.enum(QUESTION_TYPE_KEYS),
  prompt: z.string().trim().min(1).max(10000),
  passage: z.string().trim().max(20000).optional(),
  instructions: z.string().trim().max(2000).optional(),
  mediaUrl: z.string().trim().max(1000).optional().nullable(),
  options: z.array(optionSchema).max(20).optional(),
  correctAnswers: z.array(z.string().trim().max(2000)).max(20).optional(),
  pairs: z.array(pairSchema).max(30).optional(),
  blanks: z.array(blankSchema).max(30).optional(),
  labels: z.array(labelSchema).max(40).optional(),
  tableData: z.unknown().optional(),
  answerText: z.string().trim().max(20000).optional(),
  explanation: z.string().trim().max(10000).optional(),
  marks: z.coerce.number().min(0).max(1000).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string().trim().max(60)).max(20).optional(),
  isPublic: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const updateQuestionSchema = questionInputSchema.partial();

const importSchema = z.object({
  questions: z.array(questionInputSchema).min(1).max(300),
});

const listQuerySchema = z.object({
  classLevel: z.coerce.number().int().min(1).max(10).optional(),
  subject: z.string().trim().max(100).optional(),
  type: z.string().trim().max(60).optional(),
  chapter: z.string().trim().max(160).optional(),
  status: z.string().trim().max(30).optional(),
  search: z.string().trim().max(200).optional(),
  mine: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

export function questionPayload(question: Record<string, unknown>, options: { includeAnswers?: boolean } = {}) {
  const includeAnswers = options.includeAnswers !== false;
  return {
    _id: String(question._id),
    schoolId: question.schoolId ? String(question.schoolId) : null,
    createdBy: String(question.createdBy || ''),
    createdByRole: question.createdByRole || '',
    classLevel: question.classLevel,
    subject: question.subject,
    chapter: question.chapter || '',
    topic: question.topic || '',
    type: question.type,
    prompt: question.prompt,
    passage: question.passage || '',
    instructions: question.instructions || '',
    mediaUrl: question.mediaUrl || null,
    options: question.options || [],
    correctAnswers: includeAnswers ? question.correctAnswers || [] : [],
    pairs: includeAnswers
      ? question.pairs || []
      : (question.pairs as Array<Record<string, unknown>> | undefined)?.map((pair) => ({ left: pair.left, imageUrl: pair.imageUrl })),
    blanks: includeAnswers
      ? question.blanks || []
      : (question.blanks as Array<Record<string, unknown>> | undefined)?.map((blank) => ({ index: blank.index, clue: blank.clue })),
    labels: includeAnswers
      ? question.labels || []
      : (question.labels as Array<Record<string, unknown>> | undefined)?.map((label) => ({ label: label.label, x: label.x, y: label.y })),
    tableData: question.tableData ?? null,
    answerText: includeAnswers ? question.answerText || '' : '',
    explanation: includeAnswers ? question.explanation || '' : '',
    marks: question.marks,
    difficulty: question.difficulty,
    tags: question.tags || [],
    isPublic: question.isPublic,
    status: question.status,
    usageCount: question.usageCount,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

router.get('/meta/types', (_req: Request, res: Response) => {
  ok(res, { types: QUESTION_TYPES });
});

router.get(
  '/',
  requireStaff,
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const scope = visibleContentFilter(req);
    const filters: Record<string, unknown>[] = [scope];

    if (query.classLevel) filters.push({ classLevel: query.classLevel });
    if (query.subject) filters.push({ subject: query.subject });
    if (query.type && query.type !== 'all') filters.push({ type: query.type });
    if (query.chapter) filters.push({ chapter: { $regex: query.chapter, $options: 'i' } });
    if (query.status && query.status !== 'all') filters.push({ status: query.status });
    if (query.mine === 'true') filters.push({ createdBy: new Types.ObjectId(req.user!.id) });
    if (query.search) {
      filters.push({
        $or: [
          { prompt: { $regex: query.search, $options: 'i' } },
          { passage: { $regex: query.search, $options: 'i' } },
          { tags: { $regex: query.search, $options: 'i' } },
        ],
      });
    }

    const where = filters.length === 1 ? filters[0] : { $and: filters };
    const [questions, total] = await Promise.all([
      QuestionModel.find(where)
        .sort({ updatedAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      QuestionModel.countDocuments(where),
    ]);

    ok(res, {
      questions: questions.map((question) => questionPayload(question as unknown as Record<string, unknown>)),
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
    const question = await QuestionModel.findById(req.params.id).lean();
    if (!question) return fail(res, 404, 'Question not found');
    const scope = visibleContentFilter(req);
    const allowed = await QuestionModel.exists({ _id: question._id, ...scope });
    if (!allowed) return fail(res, 403, 'You cannot view this question');
    ok(res, { question: questionPayload(question as unknown as Record<string, unknown>) });
  })
);

router.post(
  '/',
  requireStaff,
  validate(questionInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof questionInputSchema>;
    const question = await QuestionModel.create({
      ...input,
      schoolId: req.user!.schoolId || null,
      createdBy: req.user!.id,
      createdByRole: req.user!.role,
      isPublic: req.user!.schoolId ? Boolean(input.isPublic) : true,
    });

    if (req.user!.schoolId) {
      await notificationService.notifySchoolRoles(
        req.user!.schoolId,
        ['teacher', 'school_admin'],
        {
          type: 'question',
          title: 'New question added',
          message: `${req.user!.name} added a ${input.type.replace(/_/g, ' ')} question for Class ${input.classLevel} ${input.subject}.`,
          link: `/questions`,
        },
        { actorId: req.user!.id }
      );
    } else {
      await notificationService.notifyAllStaff(
        {
          type: 'question',
          title: 'New global question',
          message: `A new Class ${input.classLevel} ${input.subject} question is available in the platform bank.`,
          link: '/questions',
        },
        { actorId: req.user!.id }
      );
    }

    res.status(201).json({
      success: true,
      question: questionPayload(question.toObject() as unknown as Record<string, unknown>),
    });
  })
);

router.post(
  '/import',
  requireStaff,
  validate(importSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof importSchema>;
    const docs = input.questions.map((question) => ({
      ...question,
      schoolId: req.user!.schoolId || null,
      createdBy: req.user!.id,
      createdByRole: req.user!.role,
      isPublic: req.user!.schoolId ? Boolean(question.isPublic) : true,
    }));
    const created = await QuestionModel.insertMany(docs);

    if (req.user!.schoolId) {
      await notificationService.notifySchoolRoles(
        req.user!.schoolId,
        ['teacher', 'school_admin'],
        {
          type: 'question',
          title: `${created.length} questions imported`,
          message: `${req.user!.name} imported questions into the Class ${input.questions[0]?.classLevel ?? ''} ${input.questions[0]?.subject ?? ''} bank.`,
          link: '/questions',
        },
        { actorId: req.user!.id }
      );
    }

    res.status(201).json({
      success: true,
      count: created.length,
      questions: created.map((question) => questionPayload(question.toObject() as unknown as Record<string, unknown>)),
    });
  })
);

router.patch(
  '/:id',
  requireStaff,
  validate(updateQuestionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const question = await QuestionModel.findById(req.params.id);
    if (!question) return fail(res, 404, 'Question not found');
    if (!canManageDocument(req, question)) return fail(res, 403, 'You cannot edit this question');

    const allowed = [
      'classLevel',
      'subject',
      'chapter',
      'topic',
      'type',
      'prompt',
      'passage',
      'instructions',
      'mediaUrl',
      'options',
      'correctAnswers',
      'pairs',
      'blanks',
      'labels',
      'tableData',
      'answerText',
      'explanation',
      'marks',
      'difficulty',
      'tags',
      'isPublic',
      'status',
    ] as const;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (question as unknown as Record<string, unknown>)[key] = req.body[key];
      }
    }
    await question.save();

    if (req.user!.schoolId) {
      await notificationService.notifySchoolRoles(
        req.user!.schoolId,
        ['teacher', 'school_admin'],
        {
          type: 'question',
          title: 'Question updated',
          message: `${req.user!.name} updated a Class ${question.classLevel} ${question.subject} question.`,
          link: '/questions',
        },
        { actorId: req.user!.id }
      );
    }

    ok(res, { question: questionPayload(question.toObject() as unknown as Record<string, unknown>) });
  })
);

router.post(
  '/:id/duplicate',
  requireStaff,
  validate(z.object({ classLevel: z.coerce.number().int().min(1).max(10).optional() })),
  asyncHandler(async (req: Request, res: Response) => {
    const question = await QuestionModel.findById(req.params.id).lean();
    if (!question) return fail(res, 404, 'Question not found');
    if (!canManageDocument(req, question)) return fail(res, 403, 'You cannot copy this question');

    const copy = await QuestionModel.create({
      ...question,
      _id: undefined,
      classLevel: req.body.classLevel ?? question.classLevel,
      createdBy: req.user!.id,
      createdByRole: req.user!.role,
      schoolId: req.user!.schoolId || null,
      usageCount: 0,
    });
    res.status(201).json({
      success: true,
      question: questionPayload(copy.toObject() as unknown as Record<string, unknown>),
    });
  })
);

router.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const question = await QuestionModel.findById(req.params.id);
    if (!question) return fail(res, 404, 'Question not found');
    if (!canManageDocument(req, question)) return fail(res, 403, 'You cannot delete this question');

    const usedInSet = await QuestionSetModel.exists({ 'items.question': question._id });
    if (usedInSet) {
      question.status = 'archived';
      await question.save();
      return ok(res, { message: 'Question is used in a question set, so it was archived instead of deleted.' });
    }
    await QuestionModel.deleteOne({ _id: question._id });
    ok(res, { message: 'Question deleted' });
  })
);

export default router;
