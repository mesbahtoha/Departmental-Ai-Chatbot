import { useEffect, useState } from 'react';
import { FaClipboardList, FaUsers, FaBookOpen } from 'react-icons/fa';
import { listAssessments, listQuestions, listSchoolMembers } from '@/lib/api-v1';
import { useAuthStore } from '@/store/auth.store';
import { StatCard } from '@/components/ui/StatCard';

export function TeacherDashboard() {
  const user = useAuthStore((s) => s.user);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [rosterCount, setRosterCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [assessments, questions, members] = await Promise.all([
        listAssessments({ page: 1, limit: 100 }).catch(() => null),
        listQuestions({ page: 1, limit: 100, mine: user?.role === 'teacher' ? 'true' : undefined }).catch(() => null),
        (user?.schoolId || user?.role === 'teacher'
          ? listSchoolMembers({ page: 1, limit: 1 }).catch(() => null)
          : Promise.resolve(null)),
      ]);
      if (cancelled) return;
      setAssessmentCount(assessments?.total ?? 0);
      setQuestionCount(questions?.total ?? 0);
      setRosterCount(members?.total ?? 0);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.schoolId, user?.role]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Teacher Dashboard</h2>
          <span className="text-sm text-muted">
            {user?.name} • {user?.schoolName ?? 'Teacher'}{user?.classLevel ? ` • Class ${user.classLevel}` : ''}
          </span>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
        <StatCard label="Questions in bank" value={questionCount} icon={<FaBookOpen />} />
        <StatCard label="Assessments created" value={assessmentCount} icon={<FaClipboardList />} />
        <StatCard label="Class roster size" value={rosterCount} icon={<FaUsers />} />
      </div>

      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="card-header">
          <span className="font-semibold">Teacher workflow</span>
        </div>
        <div className="card-body flex flex-col" style={{ gap: 10 }}>
          <span className="text-sm text-muted">1. Build questions in the question bank.</span>
          <span className="text-sm text-muted">2. Group them into question sets.</span>
          <span className="text-sm text-muted">3. Create quizzes / assignments / exams and publish them.</span>
          <span className="text-sm text-muted">4. Review incoming submissions and grade answer sheets.</span>
        </div>
      </div>
    </div>
  );
}
