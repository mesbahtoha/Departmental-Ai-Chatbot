import { AdminQuestionSets } from '@/pages/admin/QuestionSets';

/** Same question-set manager as the admin bank, scoped to the caller's school by the backend. */
export function TeacherQuestionSets() {
  return <AdminQuestionSets />;
}
