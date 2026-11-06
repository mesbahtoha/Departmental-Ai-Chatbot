import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { validate } from '../../../middleware/validate.middleware';
import { authenticate } from '../../../middleware/auth.middleware';
import { requireStaff, requireStudent } from '../../../middleware/role.middleware';
import { AssessmentModel } from '../../../database/models/Assessment.model';
import { SubmissionModel } from '../../../database/models/Submission.model';
import { QuestionModel } from '../../../database/models/Question.model';
import { QuestionSetModel } from '../../../database/models/QuestionSet.model';
import { UserModel } from '../../../database/models/User.model';
import { canManageDocument, visibleContentFilter } from '../../../utils/academic-scope';
import notificationService from '../../../services/notification.service';
import { questionPayload } from '../questions/questions.routes';
import { log } from '../../../config/logger';

const router = Router();
router.use(authenticate);

const assessmentInputSchema = z.object({
  type: z.enum(['quiz', 'assignment', 'exam']).default('quiz'),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(5000).optional(),
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(1).max(100),
  questionSetId: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        marks: z.coerce.number().min(0).max(1000).optional(),
      })
    )
    .max(200)
    .optional(),
  assignedStudentIds: z.array(z.string().trim()).max(2000).optional(),
  startAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
  shuffleQuestions: z.boolean().optional(),
  allowLateSubmission: z.boolean().optional(),
  showResults: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
});

const updateAssessmentSchema = assessmentInputSchema.partial();

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        answer: z.unknown(),
      })
    )
    .max(300),
  startedAt: z.string().datetime().optional(),
});

const gradeSchema = z.object({
  grades: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        awardedMarks: z.coerce.number().min(0).max(1000),
        feedback: z.string().trim().max(2000).optional(),
      })
    )
    .max(300),
  feedback: z.string().trim().max(2000).optional(),
});

const listQuerySchema = z.object({
  classLevel: z.coerce.number().int().min(1).max(10).optional(),
  subject: z.string().trim().max(100).optional(),
  type: z.string().trim().max(20).optional(),
  status: z.string().trim().max(20).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

function assessmentPayload(assessment: Record<string, unknown>) {
  return {
    _id: String(assessment._id),
    schoolId: assessment.schoolId ? String(assessment.schoolId) : null,
    createdBy: String(assessment.createdBy || ''),
    createdByRole: assessment.createdByRole || '',
    createdByName: assessment.createdByName || '',
    type: assessment.type,
    title: assessment.title,
    instructions: assessment.instructions || '',
    classLevel: assessment.classLevel,
    subject: assessment.subject,
    questionCount: assessment.questionCount || 0,
    totalMarks: assessment.totalMarks || 0,
    assignedStudentIds: (assessment.assignedStudentIds as unknown[])?.map(String) || [],
    startAt: assessment.startAt || null,
    dueAt: assessment.dueAt || null,
    durationMinutes: assessment.durationMinutes || 0,
    maxAttempts: assessment.maxAttempts || 1,
    shuffleQuestions: Boolean(assessment.shuffleQuestions),
    allowLateSubmission: Boolean(assessment.allowLateSubmission),
    showResults: assessment.showResults !== false,
    status: assessment.status,
    publishedAt: assessment.publishedAt || null,
    submissionCount: assessment.submissionCount || 0,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
  };
}

async function resolveAssessmentItems(
  input: { questionSetId?: string | null; items?: Array<{ question: string; marks?: number }>; classLevel: number }
) {
  let source = input.items ?? [];
  if (input.questionSetId) {
    const set = await QuestionSetModel.findById(input.questionSetId).lean();
    if (!set) throw Object.assign(new Error('Question set not found'), { statusCode: 404 });
    source = (set.items || []).map((item) => ({ question: String(item.question), marks: item.marks ?? undefined }));
  }
  const ids = source.map((item) => item.question).filter((id) => Types.ObjectId.isValid(id));
  const questions = await QuestionModel.find({ _id: { $in: ids } }).select('_id marks classLevel').lean();
  const meta = new Map(questions.map((question) => [String(question._id), question]));
  const items = source
    .filter((item) => meta.has(item.question))
    .map((item) => ({
      question: new Types.ObjectId(item.question),
      marks: item.marks ?? meta.get(item.question)?.marks ?? 1,
    }));
  return {
    items,
    totalMarks: items.reduce((sum, item) => sum + (item.marks || 0), 0),
    questionCount: items.length,
  };
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"“”‘’]/g, '');
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => (value as Record<string, unknown>)[key]);
  }
  return value === null || value === undefined || value === '' ? [] : [value];
}

/** Automatic scoring for objective NCTB question types. */
function gradeAnswer(
  question: Record<string, unknown>,
  answer: unknown
): { awarded: number; isCorrect: boolean | null; needsManual: boolean } {
  const type = String(question.type || '');
  const marks = Number(question.marks ?? 1);
  const correct = (question.correctAnswers as string[] | undefined) ?? [];
  const answerText = String(question.answerText || '');

  const exact = (expected: string) => normalize(expected) === normalize(answer);
  const anyExact = (expected: unknown[]) => {
    const list = asArray(answer).map(normalize);
    return expected.length > 0 && expected.map(normalize).every((value, index) => list[index] === value);
  };

  switch (type) {
    case 'single_mcq':
    case 'choose_correct_word':
    case 'synonyms_antonyms':
    case 'geometry_identify':
    case 'math_symbol':
    case 'passage_mcq':
      return { awarded: correct.some((value) => exact(value)) ? marks : 0, isCorrect: correct.some((value) => exact(value)), needsManual: false };

    case 'multi_mcq': {
      const chosen = asArray(answer).map(normalize).sort();
      const expected = correct.map(normalize).sort();
      const isCorrect = chosen.length === expected.length && chosen.every((value, index) => value === expected[index]);
      return { awarded: isCorrect ? marks : 0, isCorrect, needsManual: false };
    }

    case 'true_false': {
      const expected = correct[0] ?? answerText;
      const isCorrect = normalize(answer) === normalize(expected);
      return { awarded: isCorrect ? marks : 0, isCorrect, needsManual: false };
    }

    case 'fill_blanks_clue':
    case 'fill_blanks_no_clue':
    case 'grammar_application': {
      const blanks = (question.blanks as Array<{ answer?: string }> | undefined) ?? [];
      const provided = asArray(answer);
      const expected = blanks.length ? blanks.map((blank) => blank.answer || '') : correct;
      if (!expected.length) return { awarded: 0, isCorrect: null, needsManual: true };
      const isCorrect = anyExact(expected);
      void provided;
      return { awarded: isCorrect ? marks : 0, isCorrect, needsManual: !isCorrect };
    }

    case 'matching':
    case 'science_formula_unit':
    case 'ict_classification':
    case 'history_geo_match': {
      const pairs = (question.pairs as Array<{ right?: string }> | undefined) ?? [];
      const expected = pairs.map((pair) => pair.right || '');
      const isCorrect = anyExact(expected);
      return { awarded: isCorrect ? marks : 0, isCorrect, needsManual: !isCorrect };
    }

    case 'diagram_label': {
      const labels = (question.labels as Array<{ answer?: string }> | undefined) ?? [];
      const expected = labels.map((label) => label.answer || '');
      const isCorrect = anyExact(expected);
      return { awarded: isCorrect ? marks : 0, isCorrect, needsManual: !isCorrect };
    }

    case 'short_answer':
    case 'rearrange_words':
    case 'bengali_conjunct': {
      if (!answerText && !correct.length) {
        return { awarded: 0, isCorrect: null, needsManual: true };
      }
      const expected = answerText ? [answerText] : correct;
      const isCorrect = expected.some((value) => normalize(value) === normalize(answer));
      return { awarded: isCorrect ? marks : 0, isCorrect, needsManual: !isCorrect };
    }

    case 'table_completion':
    default:
      return { awarded: 0, isCorrect: null, needsManual: true };
  }
}

function studentQuestionPayload(question: Record<string, unknown>) {
  const payload = questionPayload(question, { includeAnswers: false });
  return {
    ...payload,
    pairs: ((question.pairs as Array<Record<string, unknown>> | undefined) ?? []).map((pair) => ({
      left: pair.left,
      imageUrl: pair.imageUrl,
    })),
    blanks: ((question.blanks as Array<Record<string, unknown>> | undefined) ?? []).map((blank) => ({
      index: blank.index,
      clue: blank.clue,
    })),
    labels: ((question.labels as Array<Record<string, unknown>> | undefined) ?? []).map((label) => ({
      label: label.label,
      x: label.x,
      y: label.y,
    })),
  };
}

// ---------------------------------------------------------------------------
// Student routes (must precede /:id)
// ---------------------------------------------------------------------------

router.get(
  '/student/available',
  requireStudent,
  asyncHandler(async (req: Request, res: Response) => {
    const classLevel = req.user!.classLevel;
    if (!classLevel) {
      return ok(res, { assessments: [], message: 'Choose your class in your profile to see assessments.' });
    }
    const query: Record<string, unknown> = {
      status: 'published',
      classLevel,
      $and: [
        {
          $or: [
            { assignedStudentIds: { $size: 0 } },
            { assignedStudentIds: new Types.ObjectId(req.user!.id) },
          ],
        },
      ],
    };
    if (req.user!.schoolId) {
      (query.$and as Record<string, unknown>[]).push({
        $or: [{ schoolId: new Types.ObjectId(req.user!.schoolId) }, { schoolId: null }],
      });
    } else {
      (query.$and as Record<string, unknown>[]).push({ schoolId: null });
    }

    const assessments = await AssessmentModel.find(query).sort({ dueAt: 1, createdAt: -1 }).limit(100).lean();
    const submissions = await SubmissionModel.find({
      studentId: new Types.ObjectId(req.user!.id),
      assessmentId: { $in: assessments.map((assessment) => assessment._id) },
    })
      .select('assessmentId status totalScore percentage needsGrading')
      .lean();
    const byAssessment = new Map(submissions.map((submission) => [String(submission.assessmentId), submission]));

    ok(res, {
      assessments: assessments.map((assessment) => {
        const submission = byAssessment.get(String(assessment._id));
        const overdue = assessment.dueAt ? new Date(assessment.dueAt).getTime() < Date.now() : false;
        return {
          ...assessmentPayload(assessment as unknown as Record<string, unknown>),
          submission: submission
            ? {
                _id: String(submission._id),
                status: submission.status,
                totalScore: submission.totalScore,
                percentage: submission.percentage,
                needsGrading: submission.needsGrading,
              }
            : null,
          overdue,
          canSubmit: !submission && (!overdue || Boolean(assessment.allowLateSubmission)),
        };
      }),
    });
  })
);

router.get(
  '/submissions/mine',
  requireStudent,
  asyncHandler(async (req: Request, res: Response) => {
    const submissions = await SubmissionModel.find({ studentId: new Types.ObjectId(req.user!.id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const assessmentIds = submissions.map((submission) => submission.assessmentId);
    const assessments = await AssessmentModel.find({ _id: { $in: assessmentIds } })
      .select('title type subject classLevel totalMarks showResults dueAt')
      .lean();
    const byId = new Map(assessments.map((assessment) => [String(assessment._id), assessment]));
    ok(res, {
      submissions: submissions.map((submission) => {
        const assessment = byId.get(String(submission.assessmentId));
        const visible = assessment?.showResults !== false;
        return {
          _id: String(submission._id),
          assessmentId: String(submission.assessmentId),
          assessment: assessment
            ? {
                title: assessment.title,
                type: assessment.type,
                subject: assessment.subject,
                classLevel: assessment.classLevel,
                totalMarks: assessment.totalMarks,
              }
            : null,
          status: submission.status,
          totalScore: visible ? submission.totalScore : null,
          totalMarks: submission.totalMarks,
          percentage: visible ? submission.percentage : null,
          needsGrading: submission.needsGrading,
          submittedAt: submission.submittedAt,
          gradedAt: submission.gradedAt,
        };
      }),
    });
  })
);

router.get(
  '/submissions/:submissionId',
  asyncHandler(async (req: Request, res: Response) => {
    const submission = await SubmissionModel.findById(req.params.submissionId).lean();
    if (!submission) return fail(res, 404, 'Submission not found');

    const isOwner = String(submission.studentId) === req.user!.id;
    const isStaff = ['teacher', 'school_admin', 'admin', 'superadmin'].includes(req.user!.role);
    if (!isOwner && !isStaff) return fail(res, 403, 'You cannot view this answer sheet');

    const assessment = await AssessmentModel.findById(submission.assessmentId).lean();
    if (isStaff && assessment && !canManageDocument(req, assessment) && (req.user!.role as string) !== 'superadmin') {
      // Platform admins bypass; school staff are limited to their school.
      if ((req.user!.role as string) === 'admin' || (req.user!.role as string) === 'superadmin') {
        // allowed
      } else {
        return fail(res, 403, 'You cannot view this answer sheet');
      }
    }

    const questionIds = (submission.answers || []).map((answer) => answer.question);
    const questions = await QuestionModel.find({ _id: { $in: questionIds } }).lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));
    const showAnswers = isStaff || assessment?.showResults !== false;

    ok(res, {
      submission: {
        _id: String(submission._id),
        assessmentId: String(submission.assessmentId),
        studentId: String(submission.studentId),
        status: submission.status,
        autoScore: submission.autoScore,
        manualScore: submission.manualScore,
        totalScore: showAnswers ? submission.totalScore : null,
        totalMarks: submission.totalMarks,
        percentage: showAnswers ? submission.percentage : null,
        needsGrading: submission.needsGrading,
        feedback: submission.feedback || '',
        submittedAt: submission.submittedAt,
        gradedAt: submission.gradedAt,
        answers: (submission.answers || []).map((answer) => {
          const question = byId.get(String(answer.question));
          return {
            questionId: String(answer.question),
            answer: answer.answer,
            awardedMarks: showAnswers ? answer.awardedMarks : null,
            isCorrect: showAnswers ? answer.isCorrect : null,
            feedback: showAnswers ? answer.feedback : '',
            prompt: question?.prompt || '',
            type: question?.type || '',
            marks: question?.marks ?? 1,
            correctAnswers: showAnswers ? question?.correctAnswers || [] : [],
            answerText: showAnswers ? question?.answerText || '' : '',
          };
        }),
      },
      assessment: assessment ? assessmentPayload(assessment as unknown as Record<string, unknown>) : null,
    });
  })
);

router.get(
  '/:id/take',
  requireStudent,
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id).lean();
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (assessment.status !== 'published') return fail(res, 403, 'This assessment is not open');
    if (assessment.classLevel !== req.user!.classLevel) {
      return fail(res, 403, 'This assessment is not for your class');
    }
    if (req.user!.schoolId && assessment.schoolId && String(assessment.schoolId) !== req.user!.schoolId) {
      return fail(res, 403, 'This assessment belongs to another school');
    }
    if (
      assessment.assignedStudentIds?.length &&
      !assessment.assignedStudentIds.map(String).includes(req.user!.id)
    ) {
      return fail(res, 403, 'This assessment was not assigned to you');
    }

    const existing = await SubmissionModel.findOne({
      assessmentId: assessment._id,
      studentId: new Types.ObjectId(req.user!.id),
    }).lean();
    if (existing && existing.status !== 'in_progress') {
      return fail(res, 409, 'You have already submitted this assessment');
    }

    const ordered = (assessment.items || []).map((item) => String(item.question));
    const questions = await QuestionModel.find({ _id: { $in: ordered } }).lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));
    const hydrated = (assessment.items || [])
      .map((item) => {
        const question = byId.get(String(item.question));
        return question
          ? { marks: item.marks ?? question.marks ?? 1, question: studentQuestionPayload(question as unknown as Record<string, unknown>) }
          : null;
      })
      .filter(Boolean);

    ok(res, {
      assessment: {
        ...assessmentPayload(assessment as unknown as Record<string, unknown>),
        items: hydrated,
      },
      submission: existing
        ? { _id: String(existing._id), answers: existing.answers || [], startedAt: existing.startedAt, status: existing.status }
        : null,
    });
  })
);

router.post(
  '/:id/submit',
  requireStudent,
  validate(submitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id).lean();
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (assessment.status !== 'published') return fail(res, 403, 'This assessment is not open');
    if (assessment.classLevel !== req.user!.classLevel) return fail(res, 403, 'This assessment is not for your class');
    if (req.user!.schoolId && assessment.schoolId && String(assessment.schoolId) !== req.user!.schoolId) {
      return fail(res, 403, 'This assessment belongs to another school');
    }
    if (assessment.dueAt && new Date(assessment.dueAt).getTime() < Date.now() && !assessment.allowLateSubmission) {
      return fail(res, 403, 'The deadline has passed and late submission is not allowed');
    }

    const existing = await SubmissionModel.findOne({
      assessmentId: assessment._id,
      studentId: new Types.ObjectId(req.user!.id),
    });
    if (existing && existing.status !== 'in_progress') {
      return fail(res, 409, 'You have already submitted this assessment');
    }

    const input = req.body as z.infer<typeof submitSchema>;
    const answerByQuestion = new Map(input.answers.map((answer) => [answer.question, answer.answer]));
    const ordered = assessment.items || [];
    const questions = await QuestionModel.find({ _id: { $in: ordered.map((item) => item.question) } }).lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));

    let autoScore = 0;
    let needsGrading = false;
    const gradedAnswers = ordered.map((item) => {
      const question = byId.get(String(item.question));
      const marks = item.marks ?? question?.marks ?? 1;
      const answer = answerByQuestion.get(String(item.question)) ?? null;
      if (!question) {
        return { question: item.question, answer, awardedMarks: 0, feedback: '', isCorrect: null };
      }
      const result = gradeAnswer({ ...(question as unknown as Record<string, unknown>), marks }, answer);
      autoScore += result.awarded;
      if (result.needsManual) needsGrading = true;
      return {
        question: item.question,
        answer,
        awardedMarks: result.awarded,
        feedback: '',
        isCorrect: result.isCorrect,
      };
    });

    const now = new Date();
    const payload = {
      assessmentId: assessment._id,
      studentId: new Types.ObjectId(req.user!.id),
      schoolId: req.user!.schoolId ? new Types.ObjectId(req.user!.schoolId) : null,
      classLevel: assessment.classLevel,
      answers: gradedAnswers,
      status: needsGrading ? ('submitted' as const) : ('graded' as const),
      autoScore,
      manualScore: 0,
      totalScore: autoScore,
      totalMarks: assessment.totalMarks,
      percentage: assessment.totalMarks ? Math.round((autoScore / assessment.totalMarks) * 10000) / 100 : 0,
      needsGrading,
      startedAt: input.startedAt ? new Date(input.startedAt) : null,
      submittedAt: now,
      gradedAt: needsGrading ? null : now,
      gradedBy: null,
    };

    const submission = existing
      ? await SubmissionModel.findByIdAndUpdate(existing._id, { $set: payload }, { new: true })
      : await SubmissionModel.create(payload);

    await AssessmentModel.updateOne({ _id: assessment._id }, { $inc: { submissionCount: 1 } });

    // Notify the teacher/creator and school admins that a new answer sheet arrived.
    const recipients = [String(assessment.createdBy)];
    if (assessment.schoolId) {
      const admins = await UserModel.find({ schoolId: assessment.schoolId, role: 'school_admin', isActive: true })
        .select('_id')
        .lean();
      recipients.push(...admins.map((admin) => String(admin._id)));
    }
    await notificationService.notifyUsers(recipients, {
      type: 'submission',
      title: needsGrading ? 'Answer sheet needs grading' : 'Answer sheet submitted',
      message: `${req.user!.name} submitted "${assessment.title}" (${autoScore}/${assessment.totalMarks}).`,
      link: `/assessments/${String(assessment._id)}/submissions`,
      schoolId: assessment.schoolId ? String(assessment.schoolId) : null,
    }, { actorId: req.user!.id });

    log.info('Assessment submitted', {
      assessmentId: String(assessment._id),
      studentId: req.user!.id,
      needsGrading,
      autoScore,
    });

    res.status(201).json({
      success: true,
      submission: {
        _id: String(submission!._id),
        status: submission!.status,
        autoScore: submission!.autoScore,
        totalScore: submission!.totalScore,
        totalMarks: submission!.totalMarks,
        percentage: submission!.percentage,
        needsGrading: submission!.needsGrading,
      },
      showResults: assessment.showResults !== false,
    });
  })
);

// ---------------------------------------------------------------------------
// Staff routes
// ---------------------------------------------------------------------------

router.get(
  '/',
  requireStaff,
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const filters: Record<string, unknown>[] = [visibleContentFilter(req)];
    if (query.classLevel) filters.push({ classLevel: query.classLevel });
    if (query.subject) filters.push({ subject: query.subject });
    if (query.type && query.type !== 'all') filters.push({ type: query.type });
    if (query.status && query.status !== 'all') filters.push({ status: query.status });
    if (query.search) filters.push({ title: { $regex: query.search, $options: 'i' } });
    const where = filters.length === 1 ? filters[0] : { $and: filters };

    const [assessments, total] = await Promise.all([
      AssessmentModel.find(where)
        .sort({ updatedAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      AssessmentModel.countDocuments(where),
    ]);
    const ids = assessments.map((assessment) => assessment._id);
    const pending = await SubmissionModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { assessmentId: { $in: ids }, needsGrading: true } },
      { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
    ]);
    const pendingById = new Map(pending.map((item) => [String(item._id), item.count]));

    ok(res, {
      assessments: assessments.map((assessment) => ({
        ...assessmentPayload(assessment as unknown as Record<string, unknown>),
        pendingGrading: pendingById.get(String(assessment._id)) || 0,
      })),
      total,
      page: query.page,
      limit: query.limit,
    });
  })
);

router.post(
  '/',
  requireStaff,
  validate(assessmentInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof assessmentInputSchema>;
    if (!input.questionSetId && !input.items?.length) {
      return fail(res, 400, 'Select a question set or add at least one question');
    }
    const resolved = await resolveAssessmentItems(input);
    if (!resolved.items.length) return fail(res, 400, 'None of the selected questions could be found');

    const assessment = await AssessmentModel.create({
      schoolId: req.user!.schoolId || null,
      createdBy: req.user!.id,
      createdByRole: req.user!.role,
      createdByName: req.user!.name,
      type: input.type,
      title: input.title,
      instructions: input.instructions || '',
      classLevel: input.classLevel,
      subject: input.subject,
      assignedStudentIds: (input.assignedStudentIds || []).filter((id) => Types.ObjectId.isValid(id)),
      startAt: input.startAt ? new Date(input.startAt) : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      durationMinutes: input.durationMinutes ?? 0,
      maxAttempts: input.maxAttempts ?? 1,
      shuffleQuestions: Boolean(input.shuffleQuestions),
      allowLateSubmission: Boolean(input.allowLateSubmission),
      showResults: input.showResults !== false,
      status: input.status || 'draft',
      publishedAt: input.status === 'published' ? new Date() : null,
      ...resolved,
    });

    if (assessment.status === 'published') {
      await publishNotifications(assessment, req.user!.id);
    }

    res.status(201).json({
      success: true,
      assessment: assessmentPayload(assessment.toObject() as unknown as Record<string, unknown>),
    });
  })
);

async function publishNotifications(
  assessment: { _id: unknown; title: string; classLevel: number; subject: string; schoolId?: unknown; assignedStudentIds?: unknown[]; type: string },
  actorId: string
) {
  const payload = {
    type: 'assessment' as const,
    title: `New ${assessment.type}: ${assessment.title}`,
    message: `Class ${assessment.classLevel} ${assessment.subject} ${assessment.type} is now available.`,
    link: '/student',
    schoolId: assessment.schoolId ? String(assessment.schoolId) : null,
  };
  if (assessment.assignedStudentIds?.length) {
    await notificationService.notifyUsers(assessment.assignedStudentIds.map(String), payload, { actorId });
  } else {
    await notificationService.notifyClassStudents(
      assessment.schoolId ? String(assessment.schoolId) : null,
      assessment.classLevel,
      payload,
      { actorId }
    );
  }
  if (assessment.schoolId) {
    await notificationService.notifySchoolRoles(String(assessment.schoolId), ['teacher', 'school_admin'], {
      ...payload,
      title: `${assessment.type} published`,
      message: `"${assessment.title}" was published for Class ${assessment.classLevel}.`,
    }, { actorId });
  }
}

router.get(
  '/:id',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id).lean();
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot view this assessment');

    const ordered = (assessment.items || []).map((item) => String(item.question));
    const questions = await QuestionModel.find({ _id: { $in: ordered } }).lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));
    const hydrated = (assessment.items || [])
      .map((item) => {
        const question = byId.get(String(item.question));
        return question
          ? { marks: item.marks ?? question.marks ?? 1, question: questionPayload(question as unknown as Record<string, unknown>) }
          : null;
      })
      .filter(Boolean);

    const [submissionCount, pendingGrading] = await Promise.all([
      SubmissionModel.countDocuments({ assessmentId: assessment._id }),
      SubmissionModel.countDocuments({ assessmentId: assessment._id, needsGrading: true }),
    ]);

    ok(res, {
      assessment: {
        ...assessmentPayload(assessment as unknown as Record<string, unknown>),
        submissionCount,
        pendingGrading,
        items: hydrated,
      },
    });
  })
);

router.patch(
  '/:id',
  requireStaff,
  validate(updateAssessmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id);
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot edit this assessment');

    const editable = [
      'type',
      'title',
      'instructions',
      'classLevel',
      'subject',
      'assignedStudentIds',
      'durationMinutes',
      'maxAttempts',
      'shuffleQuestions',
      'allowLateSubmission',
      'showResults',
      'status',
    ] as const;
    for (const key of editable) {
      if (req.body[key] !== undefined) (assessment as unknown as Record<string, unknown>)[key] = req.body[key];
    }
    if (req.body.startAt !== undefined) assessment.startAt = req.body.startAt ? new Date(req.body.startAt) : null;
    if (req.body.dueAt !== undefined) assessment.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    if (req.body.items || req.body.questionSetId) {
      const resolved = await resolveAssessmentItems({
        questionSetId: req.body.questionSetId,
        items: req.body.items,
        classLevel: assessment.classLevel,
      });
      if (!resolved.items.length) return fail(res, 400, 'None of the selected questions could be found');
      assessment.items = resolved.items as never;
      assessment.totalMarks = resolved.totalMarks;
      assessment.questionCount = resolved.questionCount;
    }

    const wasPublished = assessment.status === 'published';
    if (req.body.status === 'published' && !assessment.publishedAt) assessment.publishedAt = new Date();
    await assessment.save();

    if (!wasPublished && assessment.status === 'published') {
      await publishNotifications(assessment, req.user!.id);
    }

    ok(res, { assessment: assessmentPayload(assessment.toObject() as unknown as Record<string, unknown>) });
  })
);

router.post(
  '/:id/publish',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id);
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot publish this assessment');
    if (!assessment.questionCount) return fail(res, 400, 'Add at least one question before publishing');
    assessment.status = 'published';
    assessment.publishedAt = new Date();
    await assessment.save();
    await publishNotifications(assessment, req.user!.id);
    ok(res, { assessment: assessmentPayload(assessment.toObject() as unknown as Record<string, unknown>) });
  })
);

router.post(
  '/:id/close',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id);
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot close this assessment');
    assessment.status = 'closed';
    await assessment.save();
    ok(res, { assessment: assessmentPayload(assessment.toObject() as unknown as Record<string, unknown>) });
  })
);

router.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id);
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot delete this assessment');
    await Promise.all([
      AssessmentModel.deleteOne({ _id: assessment._id }),
      SubmissionModel.deleteMany({ assessmentId: assessment._id }),
    ]);
    ok(res, { message: 'Assessment and its submissions were deleted' });
  })
);

router.get(
  '/:id/submissions',
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await AssessmentModel.findById(req.params.id).lean();
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot view these submissions');

    const submissions = await SubmissionModel.find({ assessmentId: assessment._id })
      .sort({ needsGrading: -1, submittedAt: -1 })
      .lean();
    const students = await UserModel.find({ _id: { $in: submissions.map((submission) => submission.studentId) } })
      .select('name email classLevel studentRoll')
      .lean();
    const byId = new Map(students.map((student) => [String(student._id), student]));

    ok(res, {
      assessment: assessmentPayload(assessment as unknown as Record<string, unknown>),
      submissions: submissions.map((submission) => {
        const student = byId.get(String(submission.studentId));
        return {
          _id: String(submission._id),
          studentId: String(submission.studentId),
          student: student
            ? {
                name: student.name,
                email: student.email,
                classLevel: student.classLevel,
                studentRoll: student.studentRoll,
              }
            : null,
          status: submission.status,
          autoScore: submission.autoScore,
          manualScore: submission.manualScore,
          totalScore: submission.totalScore,
          totalMarks: submission.totalMarks,
          percentage: submission.percentage,
          needsGrading: submission.needsGrading,
          submittedAt: submission.submittedAt,
          gradedAt: submission.gradedAt,
        };
      }),
    });
  })
);

router.patch(
  '/submissions/:submissionId/grade',
  requireStaff,
  validate(gradeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const submission = await SubmissionModel.findById(req.params.submissionId);
    if (!submission) return fail(res, 404, 'Submission not found');
    const assessment = await AssessmentModel.findById(submission.assessmentId);
    if (!assessment) return fail(res, 404, 'Assessment not found');
    if (!canManageDocument(req, assessment)) return fail(res, 403, 'You cannot grade this submission');

    const input = req.body as z.infer<typeof gradeSchema>;
    const gradeByQuestion = new Map(input.grades.map((grade) => [grade.question, grade]));
    let manualScore = 0;
    let needsGrading = false;

    submission.answers = submission.answers.map((answer) => {
      const grade = gradeByQuestion.get(String(answer.question));
      if (!grade) {
        if (answer.isCorrect === null) needsGrading = true;
        if (answer.isCorrect === null) manualScore += answer.awardedMarks || 0;
        return answer;
      }
      const updated = {
        ...answer.toObject(),
        awardedMarks: grade.awardedMarks,
        feedback: grade.feedback || '',
        isCorrect: grade.awardedMarks > 0,
      };
      manualScore += grade.awardedMarks;
      return updated;
    }) as never;

    // Keep auto-scored objective answers intact.
    const manualQuestionIds = new Set(input.grades.map((grade) => grade.question));
    const autoScore = submission.answers
      .filter((answer) => !manualQuestionIds.has(String(answer.question)))
      .reduce((sum, answer) => sum + (answer.awardedMarks || 0), 0);
    const totalScore = autoScore + manualScore;

    submission.autoScore = autoScore;
    submission.manualScore = manualScore;
    submission.totalScore = totalScore;
    submission.percentage = submission.totalMarks ? Math.round((totalScore / submission.totalMarks) * 10000) / 100 : 0;
    submission.needsGrading = needsGrading;
    submission.status = needsGrading ? 'submitted' : 'graded';
    submission.gradedAt = needsGrading ? null : new Date();
    submission.gradedBy = new Types.ObjectId(req.user!.id);
    if (input.feedback !== undefined) submission.feedback = input.feedback;
    await submission.save();

    await notificationService.notifyUsers([String(submission.studentId)], {
      type: 'submission',
      title: needsGrading ? 'Answer sheet updated' : 'Result published',
      message: needsGrading
        ? `Your answer sheet for "${assessment.title}" has been partly graded.`
        : `You scored ${totalScore}/${submission.totalMarks} (${submission.percentage}%) in "${assessment.title}".`,
      link: `/student/results`,
      schoolId: submission.schoolId ? String(submission.schoolId) : null,
    }, { actorId: req.user!.id });

    ok(res, {
      submission: {
        _id: String(submission._id),
        status: submission.status,
        autoScore: submission.autoScore,
        manualScore: submission.manualScore,
        totalScore: submission.totalScore,
        totalMarks: submission.totalMarks,
        percentage: submission.percentage,
        needsGrading: submission.needsGrading,
      },
    });
  })
);

export default router;
