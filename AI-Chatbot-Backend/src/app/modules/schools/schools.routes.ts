import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { validate } from '../../../middleware/validate.middleware';
import { authenticate } from '../../../middleware/auth.middleware';
import { requireAdmin, requireRole, requireSchoolScope } from '../../../middleware/role.middleware';
import { SchoolModel } from '../../../database/models/School.model';
import { UserModel } from '../../../database/models/User.model';
import { QuestionModel } from '../../../database/models/Question.model';
import { QuestionSetModel } from '../../../database/models/QuestionSet.model';
import { AssessmentModel } from '../../../database/models/Assessment.model';
import { SubmissionModel } from '../../../database/models/Submission.model';
import { StudyMaterialModel } from '../../../database/models/StudyMaterial.model';
import { NotificationModel } from '../../../database/models/Notification.model';
import { QUESTION_TYPES, SCHOOL_TYPES } from '../../../constants/academic';
import { isPlatformRole } from '../../../constants';
import notificationService from '../../../services/notification.service';
import { log } from '../../../config/logger';

const router = Router();
router.use(authenticate);

const createSchoolSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(SCHOOL_TYPES).default('school'),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  district: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  plan: z.enum(['free', 'basic', 'standard', 'enterprise']).default('free'),
  planExpiresAt: z.string().datetime().optional().nullable(),
  maxTeachers: z.coerce.number().int().min(1).max(10000).optional(),
  maxStudents: z.coerce.number().int().min(1).max(100000).optional(),
  classLevels: z.array(z.coerce.number().int().min(1).max(10)).min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
  adminName: z.string().trim().min(2).max(80).optional(),
  adminEmail: z.string().trim().email().max(160).optional().or(z.literal('')),
  adminPassword: z.string().min(6).max(72).optional(),
  adminPhone: z.string().trim().max(40).optional(),
});

const updateSchoolSchema = createSchoolSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const createMemberSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(72).optional(),
  role: z.enum(['teacher', 'student']),
  classLevel: z.coerce.number().int().min(1).max(10).optional(),
  phone: z.string().trim().max(40).optional(),
  designation: z.string().trim().max(100).optional(),
  subjects: z.array(z.string().trim().max(60)).max(20).optional(),
  assignedClasses: z.array(z.coerce.number().int().min(1).max(10)).max(10).optional(),
  studentRoll: z.string().trim().max(40).optional(),
  guardianName: z.string().trim().max(80).optional(),
  guardianPhone: z.string().trim().max(40).optional(),
});

const updateMemberSchema = createMemberSchema.omit({ role: true, email: true, password: true }).partial().extend({
  isActive: z.boolean().optional(),
});

function generateCode(name: string): string {
  const prefix = (name.replace(/[^A-Za-z]/g, '').slice(0, 4) || 'SHKL').toUpperCase();
  return `${prefix}${crypto.randomInt(1000, 9999)}`;
}

async function uniqueCode(name: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateCode(name);
    const exists = await SchoolModel.exists({ code });
    if (!exists) return code;
  }
  return `${generateCode(name)}${crypto.randomInt(10, 99)}`;
}

async function refreshSchoolStats(schoolId: string | Types.ObjectId) {
  const [teachers, students, questions, assessments] = await Promise.all([
    UserModel.countDocuments({ schoolId, role: { $in: ['teacher', 'school_admin'] } }),
    UserModel.countDocuments({ schoolId, role: { $in: ['student', 'user'] } }),
    QuestionModel.countDocuments({ schoolId }),
    AssessmentModel.countDocuments({ schoolId }),
  ]);
  await SchoolModel.updateOne({ _id: schoolId }, { $set: { stats: { teachers, students, questions, assessments } } });
}

function schoolPayload(school: Record<string, unknown>) {
  return {
    _id: String(school._id),
    name: school.name,
    type: school.type,
    code: school.code,
    email: school.email,
    phone: school.phone,
    address: school.address,
    district: school.district,
    website: school.website,
    classLevels: school.classLevels,
    plan: school.plan,
    planExpiresAt: school.planExpiresAt,
    maxTeachers: school.maxTeachers,
    maxStudents: school.maxStudents,
    isActive: school.isActive,
    notes: school.notes,
    stats: school.stats || { teachers: 0, students: 0, questions: 0, assessments: 0 },
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
  };
}

function userPayload(user: Record<string, unknown>) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId ? String(user.schoolId) : null,
    classLevel: user.classLevel ?? null,
    phone: user.phone || '',
    designation: user.designation || '',
    subjects: user.subjects || [],
    assignedClasses: user.assignedClasses || [],
    studentRoll: user.studentRoll || '',
    guardianName: user.guardianName || '',
    guardianPhone: user.guardianPhone || '',
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Platform (Super Admin) - schools
// ---------------------------------------------------------------------------

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { search, type, isActive } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } },
      ];
    }
    if (type && type !== 'all') query.type = type;
    if (isActive === 'true') query.isActive = true;
    if (isActive === 'false') query.isActive = false;

    const [schools, total] = await Promise.all([
      SchoolModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SchoolModel.countDocuments(query),
    ]);

    const ids = schools.map((school) => school._id);
    const admins = await UserModel.find({ schoolId: { $in: ids }, role: 'school_admin' })
      .select('name email schoolId')
      .lean();
    const adminBySchool = new Map(admins.map((admin) => [String(admin.schoolId), admin]));

    ok(res, {
      schools: schools.map((school) => ({
        ...schoolPayload(school as unknown as Record<string, unknown>),
        admin: adminBySchool.has(String(school._id))
          ? {
              name: adminBySchool.get(String(school._id))?.name,
              email: adminBySchool.get(String(school._id))?.email,
            }
          : null,
      })),
      total,
      page,
      limit,
    });
  })
);

router.post(
  '/',
  requireAdmin,
  validate(createSchoolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof createSchoolSchema>;
    const adminEmail = input.adminEmail?.toLowerCase().trim();

    if (adminEmail) {
      const exists = await UserModel.exists({ email: adminEmail });
      if (exists) return fail(res, 409, 'A user with the school admin email already exists');
    }

    const code = await uniqueCode(input.name);
    const school = await SchoolModel.create({
      name: input.name,
      type: input.type,
      code,
      email: input.email || '',
      phone: input.phone || '',
      address: input.address || '',
      district: input.district || '',
      website: input.website || '',
      plan: input.plan,
      planExpiresAt: input.planExpiresAt ? new Date(input.planExpiresAt) : null,
      maxTeachers: input.maxTeachers ?? 50,
      maxStudents: input.maxStudents ?? 1000,
      classLevels: input.classLevels ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      notes: input.notes || '',
      createdBy: req.user!.email,
    });

    let generatedPassword: string | null = null;
    let adminUser = null;
    if (adminEmail && input.adminName) {
      generatedPassword = input.adminPassword || crypto.randomBytes(5).toString('hex');
      const passwordHash = bcrypt.hashSync(generatedPassword, 10);
      adminUser = await UserModel.create({
        name: input.adminName,
        email: adminEmail,
        passwordHash,
        role: 'school_admin',
        schoolId: school._id,
        phone: input.adminPhone || '',
        mustChangePassword: !input.adminPassword,
        createdBy: req.user!.id,
      });
      await refreshSchoolStats(school._id);
      await notificationService.notifyUsers([String(adminUser._id)], {
        type: 'school',
        title: `Welcome to ${school.name}`,
        message: `Your school workspace is ready. Share the join code ${school.code} with students so they can register.`,
        link: '/school',
        schoolId: String(school._id),
      });
    }

    await notificationService.notifyPlatformAdmins(
      {
        type: 'school',
        title: 'New school added',
        message: `${school.name} (${school.code}) was created on the platform.`,
        link: '/admin/schools',
      },
      { actorId: req.user!.id }
    );

    log.info('School created', { schoolId: String(school._id), code: school.code });
    res.status(201).json({
      success: true,
      school: schoolPayload(school.toObject() as unknown as Record<string, unknown>),
      admin: adminUser ? userPayload(adminUser.toObject() as unknown as Record<string, unknown>) : null,
      credentials: generatedPassword ? { email: adminEmail, password: generatedPassword } : null,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const school = await SchoolModel.findById(req.params.id).lean();
    if (!school) return fail(res, 404, 'School not found');
    if (!isPlatformRole(req.user!.role) && String(school._id) !== req.user!.schoolId) {
      return fail(res, 403, 'You can only view your own school');
    }
    const admins = await UserModel.find({ schoolId: school._id, role: 'school_admin' })
      .select('name email phone isActive lastLoginAt')
      .lean();
    ok(res, {
      school: schoolPayload(school as unknown as Record<string, unknown>),
      admins: admins.map((admin) => userPayload(admin as unknown as Record<string, unknown>)),
    });
  })
);

router.patch(
  '/:id',
  validate(updateSchoolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const school = await SchoolModel.findById(req.params.id);
    if (!school) return fail(res, 404, 'School not found');

    const platform = isPlatformRole(req.user!.role);
    if (!platform && String(school._id) !== req.user!.schoolId) {
      return fail(res, 403, 'You can only update your own school');
    }

    const allowed = platform
      ? [
          'name',
          'type',
          'email',
          'phone',
          'address',
          'district',
          'website',
          'plan',
          'planExpiresAt',
          'maxTeachers',
          'maxStudents',
          'classLevels',
          'notes',
          'isActive',
        ]
      : ['phone', 'address', 'district', 'website', 'email'];
    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      (school as unknown as Record<string, unknown>)[key] =
        key === 'planExpiresAt' ? (req.body[key] ? new Date(req.body[key]) : null) : req.body[key];
    }
    await school.save();

    if (req.body.isActive === true && platform) {
      await UserModel.updateMany({ schoolId: school._id, role: 'school_admin' }, { $set: { isActive: true } });
      await notificationService.notifySchoolRoles(String(school._id), ['school_admin'], {
        type: 'school',
        title: 'School reactivated',
        message: `${school.name} is active again.`,
        link: '/school',
      });
    }

    ok(res, { school: schoolPayload(school.toObject() as unknown as Record<string, unknown>) });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const school = await SchoolModel.findById(req.params.id);
    if (!school) return fail(res, 404, 'School not found');

    if (req.query.hard === 'true') {
      await Promise.all([
        UserModel.deleteMany({ schoolId: school._id }),
        QuestionModel.deleteMany({ schoolId: school._id }),
        QuestionSetModel.deleteMany({ schoolId: school._id }),
        AssessmentModel.deleteMany({ schoolId: school._id }),
        SubmissionModel.deleteMany({ schoolId: school._id }),
        StudyMaterialModel.deleteMany({ schoolId: school._id }),
        NotificationModel.deleteMany({ schoolId: school._id }),
      ]);
      await SchoolModel.deleteOne({ _id: school._id });
      return ok(res, { message: 'School and all its data were permanently deleted' });
    }

    school.isActive = false;
    await school.save();
    await UserModel.updateMany({ schoolId: school._id }, { $set: { isActive: false } });
    ok(res, { message: 'School deactivated. Members can no longer log in.' });
  })
);

// ---------------------------------------------------------------------------
// School workspace (School Admin + Teacher read access)
// ---------------------------------------------------------------------------

router.get(
  '/me/workspace',
  requireRole('school_admin', 'teacher'),
  requireSchoolScope,
  asyncHandler(async (req: Request, res: Response) => {
    const school = await SchoolModel.findById(req.user!.schoolId).lean();
    if (!school) return fail(res, 404, 'School not found');
    const [teachers, students, questions, assessments, pendingGrading] = await Promise.all([
      UserModel.countDocuments({ schoolId: school._id, role: 'teacher' }),
      UserModel.countDocuments({ schoolId: school._id, role: { $in: ['student', 'user'] } }),
      QuestionModel.countDocuments({ schoolId: school._id }),
      AssessmentModel.countDocuments({ schoolId: school._id }),
      SubmissionModel.countDocuments({ schoolId: school._id, needsGrading: true }),
    ]);
    ok(res, {
      school: schoolPayload(school as unknown as Record<string, unknown>),
      stats: { teachers, students, questions, assessments, pendingGrading },
    });
  })
);

router.get(
  '/me/members',
  requireRole('school_admin', 'teacher'),
  requireSchoolScope,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, search, classLevel } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const query: Record<string, unknown> = { schoolId: req.user!.schoolId };
    if (role === 'teacher') query.role = 'teacher';
    else if (role === 'student') query.role = { $in: ['student', 'user'] };
    else query.role = { $in: ['teacher', 'student', 'user'] };
    if (classLevel) query.classLevel = Number(classLevel);
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentRoll: { $regex: search, $options: 'i' } },
      ];
    }
    const [members, total] = await Promise.all([
      UserModel.find(query).sort({ role: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      UserModel.countDocuments(query),
    ]);
    ok(res, {
      members: members.map((member) => userPayload(member as unknown as Record<string, unknown>)),
      total,
      page,
      limit,
    });
  })
);

router.post(
  '/me/members',
  requireRole('school_admin'),
  requireSchoolScope,
  validate(createMemberSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof createMemberSchema>;
    const email = input.email.toLowerCase().trim();
    const exists = await UserModel.exists({ email });
    if (exists) return fail(res, 409, 'A user with this email already exists');

    const school = await SchoolModel.findById(req.user!.schoolId).lean();
    if (!school) return fail(res, 404, 'School not found');

    const counts = await UserModel.countDocuments({
      schoolId: school._id,
      role: input.role === 'teacher' ? 'teacher' : { $in: ['student', 'user'] },
    });
    if (input.role === 'teacher' && counts >= (school.maxTeachers || 50)) {
      return fail(res, 409, `Your plan allows at most ${school.maxTeachers} teachers.`);
    }
    if (input.role === 'student' && counts >= (school.maxStudents || 1000)) {
      return fail(res, 409, `Your plan allows at most ${school.maxStudents} students.`);
    }

    const generatedPassword = input.password || crypto.randomBytes(5).toString('hex');
    const passwordHash = bcrypt.hashSync(generatedPassword, 10);
    const member = await UserModel.create({
      name: input.name,
      email,
      passwordHash,
      role: input.role,
      schoolId: school._id,
      classLevel: input.classLevel ?? null,
      phone: input.phone || '',
      designation: input.designation || '',
      subjects: input.subjects || [],
      assignedClasses: input.assignedClasses || (input.classLevel ? [input.classLevel] : []),
      studentRoll: input.studentRoll || '',
      guardianName: input.guardianName || '',
      guardianPhone: input.guardianPhone || '',
      mustChangePassword: !input.password,
      createdBy: req.user!.id,
    });

    await refreshSchoolStats(school._id);

    await notificationService.notifyUsers([String(member._id)], {
      type: 'user',
      title: `Welcome to ${school.name}`,
      message:
        input.role === 'teacher'
          ? 'Your teacher account is ready. Start by creating questions and assessments.'
          : `Your student account is ready. Your class is Class ${input.classLevel ?? '-'}.`,
      link: input.role === 'teacher' ? '/teacher' : '/student',
      schoolId: String(school._id),
    });

    await notificationService.notifySchoolRoles(
      String(school._id),
      ['school_admin'],
      {
        type: 'user',
        title: `New ${input.role} added`,
        message: `${member.name} joined ${school.name}.`,
        link: input.role === 'teacher' ? '/school/teachers' : '/school/students',
      },
      { actorId: req.user!.id }
    );

    res.status(201).json({
      success: true,
      member: userPayload(member.toObject() as unknown as Record<string, unknown>),
      credentials: input.password ? null : { email, password: generatedPassword },
    });
  })
);

router.patch(
  '/me/members/:userId',
  requireRole('school_admin'),
  requireSchoolScope,
  validate(updateMemberSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const member = await UserModel.findOne({ _id: req.params.userId, schoolId: req.user!.schoolId });
    if (!member) return fail(res, 404, 'Member not found in your school');
    if (member.role === 'school_admin') return fail(res, 403, 'Use the school settings to manage a School Admin');

    const allowed = [
      'name',
      'classLevel',
      'phone',
      'designation',
      'subjects',
      'assignedClasses',
      'studentRoll',
      'guardianName',
      'guardianPhone',
      'isActive',
    ] as const;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (member as unknown as Record<string, unknown>)[key] = req.body[key];
      }
    }
    await member.save();
    await refreshSchoolStats(req.user!.schoolId!);

    if (req.body.isActive === false) {
      await notificationService.notifyUsers([String(member._id)], {
        type: 'user',
        title: 'Account disabled',
        message: 'Your account has been disabled by your school administrator.',
        link: '/',
        schoolId: req.user!.schoolId,
      });
    }

    ok(res, { member: userPayload(member.toObject() as unknown as Record<string, unknown>) });
  })
);

router.delete(
  '/me/members/:userId',
  requireRole('school_admin'),
  requireSchoolScope,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await UserModel.findOne({ _id: req.params.userId, schoolId: req.user!.schoolId });
    if (!member) return fail(res, 404, 'Member not found in your school');
    if (member.role === 'school_admin') return fail(res, 403, 'A School Admin cannot be removed here');
    member.isActive = false;
    await member.save();
    await refreshSchoolStats(req.user!.schoolId!);
    ok(res, { message: 'Member deactivated' });
  })
);

router.post(
  '/me/members/:userId/reset-password',
  requireRole('school_admin'),
  requireSchoolScope,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await UserModel.findOne({ _id: req.params.userId, schoolId: req.user!.schoolId });
    if (!member) return fail(res, 404, 'Member not found in your school');
    if (member.role === 'school_admin') return fail(res, 403, 'A School Admin cannot be reset here');
    const password = crypto.randomBytes(5).toString('hex');
    member.passwordHash = bcrypt.hashSync(password, 10);
    member.mustChangePassword = true;
    await member.save();
    ok(res, { credentials: { email: member.email, password } });
  })
);

// ---------------------------------------------------------------------------
// Academic metadata
// ---------------------------------------------------------------------------

router.get(
  '/meta/academic',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, {
      classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      questionTypes: QUESTION_TYPES,
      schoolTypes: SCHOOL_TYPES,
    });
  })
);

export default router;
