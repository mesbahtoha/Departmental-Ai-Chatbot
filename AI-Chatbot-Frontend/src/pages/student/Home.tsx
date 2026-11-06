import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MdAssignment, MdAutoStories } from 'react-icons/md';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { listStudentAssessments } from '@/lib/api-v1';
import { useAuthStore } from '@/store/auth.store';
import type { StudentAssessment } from '@/types';
import { getErrorMessage } from '@/lib/api';

export function StudentHome() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<StudentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const available = await listStudentAssessments();
      setQuizzes(available ?? []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = quizzes.filter((quiz) => !quiz.submission);
  const completed = quizzes.filter((quiz) => quiz.submission);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>My learning</h2>
          <span className="text-sm text-muted">
            {user?.name}{user?.classLevel ? ` • Class ${user.classLevel}` : ''}{user?.schoolName ? ` • ${user.schoolName}` : ''}
          </span>
        </div>
        <div className="page-header-actions">
          <Link to="/chat" className="btn btn-secondary"><MdAutoStories size={17} /> AI Tutor</Link>
        </div>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      {loading ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p className="text-muted">Loading your assessments…</p>
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 16, margin: '18px 0 8px' }}>Available now ({pending.length})</h3>
          {pending.length === 0 ? (
            <EmptyState icon={<MdAssignment size={40} />} title="No open assessments" description="Your teacher hasn't published anything for your class yet." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {pending.map((quiz) => (
                <div key={quiz._id} className="card card-pad flex items-center justify-between" style={{ gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="font-semibold">{quiz.title}</div>
                    <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                      Class {quiz.classLevel} • {quiz.subject} • {quiz.type} • {quiz.totalMarks} marks • {quiz.durationMinutes ? `${quiz.durationMinutes} min` : 'No time limit'}
                    </div>
                    {quiz.dueAt && <div className="text-xs text-muted" style={{ marginTop: 2 }}>Due: {new Date(quiz.dueAt).toLocaleString()}</div>}
                  </div>
                  {quiz.canSubmit ? (
                    <Button onClick={() => quiz.status === 'published' ? navigate(`/student/quizzes/${quiz._id}/take`) : toast('This assessment is not open yet')}>
                      Take {quiz.type}
                    </Button>
                  ) : (
                    <Badge variant="muted">{quiz.overdue ? 'Overdue' : 'Unavailable'}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 16, margin: '24px 0 8px' }}>Completed ({completed.length})</h3>
          {completed.length === 0 ? (
            <p className="text-muted text-sm">Nothing submitted yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {completed.map((quiz) => (
                <div key={quiz._id} className="card card-pad flex items-center justify-between" style={{ gap: 16 }}>
                  <div>
                    <div className="font-semibold">{quiz.title}</div>
                    <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                      Class {quiz.classLevel} • {quiz.subject} • {quiz.type}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge variant={quiz.submission?.needsGrading ? 'warning' : 'success'}>
                      {quiz.submission?.needsGrading ? 'Awaiting grading' : 'Graded'}
                    </Badge>
                    {quiz.submission && (
                      <div className="text-sm" style={{ marginTop: 6 }}>{quiz.submission.totalScore} / {quiz.totalMarks} marks</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
