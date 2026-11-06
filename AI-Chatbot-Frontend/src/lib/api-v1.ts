import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import type {
  Assessment,
  AssessmentSubmission,
  Question,
  QuestionInput,
  QuestionSet,
  SchoolMember,
  SchoolSummary,
  StudentAssessment,
  NotificationItem,
} from '@/types';

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listNotifications(limit = 30, unreadOnly = false): Promise<{
  notifications: NotificationItem[];
  unread: number;
}> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (unreadOnly) query.set('unreadOnly', 'true');
  const payload = await apiGet<{ notifications: NotificationItem[]; unread: number }>(
    `/api/v1/notifications?${query.toString()}`
  );
  return { notifications: payload.notifications ?? [], unread: payload.unread ?? 0 };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const payload = await apiGet<{ unread: number }>('/api/v1/notifications/unread-count');
  return payload.unread ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiPatch(`/api/v1/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<number> {
  const payload = await apiPost<{ message: string; count: number }>('/api/v1/notifications/read-all', {});
  return payload.count ?? 0;
}

// ---------------------------------------------------------------------------
// Schools (Super Admin + School Admin)
// ---------------------------------------------------------------------------

export async function listSchools(params?: { search?: string; type?: string; isActive?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.type) query.set('type', params.type);
  if (params?.isActive) query.set('isActive', params.isActive);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const payload = await apiGet<{ schools: SchoolSummary[]; total: number; page: number; limit: number }>(
    `/api/v1/schools?${query.toString()}`
  );
  return { schools: payload.schools ?? [], total: payload.total ?? 0, page: payload.page ?? 1, limit: payload.limit ?? 20 };
}

export async function createSchool(input: Record<string, unknown>): Promise<{ school: SchoolSummary; admin: unknown; credentials: { email: string; password: string } | null }> {
  const payload = await apiPost('/api/v1/schools', input);
  return payload as { school: SchoolSummary; admin: unknown; credentials: { email: string; password: string } | null };
}

export async function updateSchool(id: string, input: Record<string, unknown>): Promise<SchoolSummary> {
  const payload = await apiPatch(`/api/v1/schools/${id}`, input);
  return payload as SchoolSummary;
}

export async function deleteSchool(id: string): Promise<void> {
  await apiDelete(`/api/v1/schools/${id}`);
}

export async function getSchoolWorkspace() {
  return apiGet<{
    school: SchoolSummary;
    stats: {
      teachers: number;
      students: number;
      questions: number;
      assessments: number;
      pendingGrading: number;
    };
  }>('/api/v1/schools/me/workspace');
}

export async function listSchoolMembers(params?: { role?: string; classLevel?: number; search?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.role) query.set('role', params.role);
  if (params?.classLevel) query.set('classLevel', String(params.classLevel));
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const payload = await apiGet<{ members: SchoolMember[]; total: number; page: number; limit: number }>(
    `/api/v1/schools/me/members?${query.toString()}`
  );
  return { members: payload.members ?? [], total: payload.total ?? 0, page: payload.page ?? 1, limit: payload.limit ?? 20 };
}

export async function createSchoolMember(input: Record<string, unknown>): Promise<SchoolMember> {
  const payload = await apiPost<{ member: SchoolMember }>('/api/v1/schools/me/members', input);
  return payload.member;
}

export async function updateSchoolMember(userId: string, input: Record<string, unknown>): Promise<void> {
  await apiPatch(`/api/v1/schools/me/members/${userId}`, input);
}

export async function deleteSchoolMember(userId: string): Promise<void> {
  await apiDelete(`/api/v1/schools/me/members/${userId}`);
}

export async function resetSchoolMemberPassword(userId: string): Promise<{ email: string; password: string }> {
  const payload = await apiPost<{ credentials: { email: string; password: string } }>(`/api/v1/schools/me/members/${userId}/reset-password`, {});
  return payload.credentials;
}

export async function getAcademicMeta() {
  return apiGet<{
    classes: number[];
    questionTypes: Array<{ key: string; label: string; shortLabel: string; group: string; answerMode: string; description: string }>;
    schoolTypes: string[];
  }>('/api/v1/schools/meta/academic');
}

// ---------------------------------------------------------------------------
// Questions + question sets
// ---------------------------------------------------------------------------

export async function listQuestions(params?: {
  classLevel?: number;
  subject?: string;
  type?: string;
  chapter?: string;
  status?: string;
  search?: string;
  mine?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.classLevel) query.set('classLevel', String(params.classLevel));
  if (params?.subject) query.set('subject', params.subject);
  if (params?.type) query.set('type', params.type);
  if (params?.chapter) query.set('chapter', params.chapter);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.mine) query.set('mine', params.mine);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const payload = await apiGet<{ questions: Question[]; total: number; page: number; limit: number }>(
    `/api/v1/questions?${query.toString()}`
  );
  return { questions: payload.questions ?? [], total: payload.total ?? 0, page: payload.page ?? 1, limit: payload.limit ?? 20 };
}

export async function createQuestion(input: QuestionInput): Promise<Question> {
  const payload = await apiPost<{ question: Question }>('/api/v1/questions', input);
  return payload.question;
}

export async function importQuestions(questions: QuestionInput[]): Promise<{ count: number; questions: Question[] }> {
  const payload = await apiPost<{ count: number; questions: Question[] }>('/api/v1/questions/import', { questions });
  return { count: payload.count ?? 0, questions: payload.questions ?? [] };
}

export async function updateQuestion(id: string, patch: Partial<QuestionInput>): Promise<Question> {
  const payload = await apiPatch<{ question: Question }>(`/api/v1/questions/${id}`, patch);
  return payload.question;
}

export async function deleteQuestion(id: string): Promise<void> {
  await apiDelete(`/api/v1/questions/${id}`);
}

export async function duplicateQuestion(id: string, classLevel?: number): Promise<Question> {
  const payload = await apiPost<{ question: Question }>(`/api/v1/questions/${id}/duplicate`, { classLevel });
  return payload.question;
}

export async function listQuestionSets(params?: { classLevel?: number; subject?: string; search?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.classLevel) query.set('classLevel', String(params.classLevel));
  if (params?.subject) query.set('subject', params.subject);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const payload = await apiGet<{ sets: QuestionSet[]; total: number; page: number; limit: number }>(
    `/api/v1/question-sets?${query.toString()}`
  );
  return { sets: payload.sets ?? [], total: payload.total ?? 0, page: payload.page ?? 1, limit: payload.limit ?? 20 };
}

export async function getQuestionSet(id: string) {
  return apiGet<{ set: QuestionSet; questions: Question[] }>(`/api/v1/question-sets/${id}`);
}

export async function createQuestionSet(input: {
  name: string;
  description?: string;
  classLevel: number;
  subject: string;
  items: { question: string; marks?: number | null }[];
  visibility?: 'school' | 'private' | 'global';
  status?: 'draft' | 'published' | 'archived';
}): Promise<QuestionSet> {
  const payload = await apiPost<{ set: QuestionSet }>('/api/v1/question-sets', input);
  return payload.set;
}

export async function updateQuestionSet(id: string, input: Partial<Parameters<typeof createQuestionSet>[0]>) {
  const payload = await apiPatch<{ set: QuestionSet }>(`/api/v1/question-sets/${id}`, input);
  return payload.set;
}

export async function deleteQuestionSet(id: string): Promise<void> {
  await apiDelete(`/api/v1/question-sets/${id}`);
}

// ---------------------------------------------------------------------------
// Assessments + submissions
// ---------------------------------------------------------------------------

export async function listAssessments(params?: { classLevel?: number; subject?: string; type?: string; status?: string; search?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.classLevel) query.set('classLevel', String(params.classLevel));
  if (params?.subject) query.set('subject', params.subject);
  if (params?.type) query.set('type', params.type);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const payload = await apiGet<{ assessments: Assessment[]; total: number; page: number; limit: number }>(
    `/api/v1/assessments?${query.toString()}`
  );
  return { assessments: payload.assessments ?? [], total: payload.total ?? 0, page: payload.page ?? 1, limit: payload.limit ?? 20 };
}

export async function createAssessment(input: Record<string, unknown>): Promise<Assessment> {
  const payload = await apiPost<{ assessment: Assessment }>('/api/v1/assessments', input);
  return payload.assessment;
}

export async function getAssessment(id: string): Promise<Assessment> {
  const payload = await apiGet<{ assessment: Assessment }>(`/api/v1/assessments/${id}`);
  return payload.assessment;
}

export async function getAssessmentForStudent(id: string): Promise<{
  assessment: Assessment;
  submission: { _id: string; answers: unknown[]; startedAt: string | null; status: string } | null;
}> {
  const payload = await apiGet<{
    assessment: Assessment;
    submission: { _id: string; answers: unknown[]; startedAt: string | null; status: string } | null;
  }>(`/api/v1/assessments/${id}/take`);
  return payload;
}

export async function updateAssessment(id: string, patch: Record<string, unknown>): Promise<Assessment> {
  const payload = await apiPatch<{ assessment: Assessment }>(`/api/v1/assessments/${id}`, patch);
  return payload.assessment;
}

export async function publishAssessment(id: string): Promise<Assessment> {
  const payload = await apiPost<{ assessment: Assessment }>(`/api/v1/assessments/${id}/publish`, {});
  return payload.assessment;
}

export async function closeAssessment(id: string): Promise<Assessment> {
  const payload = await apiPost<{ assessment: Assessment }>(`/api/v1/assessments/${id}/close`, {});
  return payload.assessment;
}

export async function deleteAssessment(id: string): Promise<void> {
  await apiDelete(`/api/v1/assessments/${id}`);
}

export async function listAssessmentSubmissions(assessmentId: string): Promise<{
  assessment: Assessment;
  submissions: Array<AssessmentSubmission & { student: { name: string; email: string; classLevel: number | null; studentRoll: string } | null }>;
}> {
  const payload = await apiGet(`/api/v1/assessments/${assessmentId}/submissions`);
  return payload as unknown as {
    assessment: Assessment;
    submissions: Array<AssessmentSubmission & { student: { name: string; email: string; classLevel: number | null; studentRoll: string } | null }>;
  };
}

export async function gradeSubmission(submissionId: string, grades: { question: string; awardedMarks: number; feedback?: string }[], feedback?: string): Promise<AssessmentSubmission> {
  const payload = await apiPatch<{ submission: AssessmentSubmission }>(`/api/v1/assessments/submissions/${submissionId}/grade`, { grades, feedback });
  return payload.submission;
}

export async function listStudentAssessments(): Promise<StudentAssessment[]> {
  const payload = await apiGet<{ assessments: StudentAssessment[] }>('/api/v1/assessments/student/available');
  return payload.assessments ?? [];
}

export async function listMySubmissions(): Promise<AssessmentSubmission[]> {
  const payload = await apiGet<{ submissions: AssessmentSubmission[] }>('/api/v1/assessments/submissions/mine');
  return payload.submissions ?? [];
}

export async function getSubmission(submissionId: string): Promise<{ submission: AssessmentSubmission; assessment: Assessment | null }> {
  const payload = await apiGet<{ submission: AssessmentSubmission; assessment: Assessment | null }>(
    `/api/v1/assessments/submissions/${submissionId}`
  );
  return payload;
}

export async function submitAssessment(
  assessmentId: string,
  answers: { question: string; answer: unknown }[],
  startedAt?: string
): Promise<AssessmentSubmission> {
  const payload = await apiPost<{ submission: AssessmentSubmission }>(`/api/v1/assessments/${assessmentId}/submit`, { answers, ...(startedAt ? { startedAt } : {}) });
  return payload.submission;
}

// ---------------------------------------------------------------------------
// Study materials
// ---------------------------------------------------------------------------

export interface MaterialItem {
  _id: string;
  title: string;
  description: string;
  type: string;
  classLevel: number;
  subject: string;
  chapter: string;
  externalUrl: string;
  textContent: string;
  visibility: string;
  isPublished: boolean;
  downloadCount: number;
  hasFile: boolean;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}

export async function listMaterials(params?: { type?: string; classLevel?: number; subject?: string; search?: string; mine?: string }) {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.classLevel) query.set('classLevel', String(params.classLevel));
  if (params?.subject) query.set('subject', params.subject);
  if (params?.search) query.set('search', params.search);
  if (params?.mine) query.set('mine', params.mine);
  const payload = await apiGet<{ materials: MaterialItem[] }>(`/api/v1/materials?${query.toString()}`);
  return { materials: payload.materials ?? [] };
}

export async function createMaterial(input: {
  title: string;
  description?: string;
  type: string;
  classLevel: number;
  subject: string;
  chapter?: string;
  externalUrl?: string;
  textContent?: string;
  visibility?: string;
  isPublished?: boolean;
}): Promise<MaterialItem> {
  const payload = await apiPost<{ material: MaterialItem }>('/api/v1/materials', input);
  return payload.material;
}

export async function deleteMaterial(id: string): Promise<void> {
  await apiDelete(`/api/v1/materials/${id}`);
}
