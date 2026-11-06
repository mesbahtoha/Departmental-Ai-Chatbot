import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getSubmission,
  gradeSubmission,
  listAssessments,
  listAssessmentSubmissions,
} from '@/lib/api-v1';
import type { Assessment, AssessmentSubmissionAnswer } from '@/types';
import { getErrorMessage } from '@/lib/api';

interface SubmissionSummary {
  _id: string;
  status: string;
  autoScore: number;
  manualScore: number;
  totalScore: number;
  totalMarks: number;
  percentage: number;
  needsGrading: boolean;
  submittedAt: string | null;
  gradedAt: string | null;
  student: { name: string; email: string; classLevel: number | null; studentRoll: string } | null;
}

export function TeacherSubmissions() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [grading, setGrading] = useState<{
    submissionId: string;
    feedback: string;
    answers: AssessmentSubmissionAnswer[];
    marks: Record<string, number>;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listAssessments({ page: 1, limit: 100 });
      const items = (payload.assessments ?? []).filter((item) => (item.submissionCount ?? 0) > 0 || item.status === 'published');
      setAssessments(items);
      if (items.length > 0 && !selectedId) setSelectedId(items[0]._id);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  const loadSubmissions = useCallback(async () => {
    if (!selectedId) {
      setSubmissions([]);
      return;
    }
    try {
      const payload = await listAssessmentSubmissions(selectedId);
      setSubmissions(payload.submissions ?? []);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [selectedId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const startGrading = useCallback(async (submissionId: string) => {
    try {
      const payload = await getSubmission(submissionId);
      const submission = payload.submission;
      const marks: Record<string, number> = {};
      for (const answer of submission.answers) {
        marks[answer.questionId] = answer.awardedMarks ?? 0;
      }
      setGrading({
        submissionId,
        feedback: submission.feedback ?? '',
        answers: submission.answers,
        marks,
      });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }, []);

  const saveGrading = async () => {
    if (!grading) return;
    setSaving(true);
    try {
      const grades = grading.answers
        .filter((answer) => answer.isCorrect === null)
        .map((answer) => ({
          question: answer.questionId,
          awardedMarks: Number(grading.marks[answer.questionId] ?? 0),
        }));
      await gradeSubmission(grading.submissionId, grades, grading.feedback.trim() || undefined);
      toast.success('Submission graded');
      setGrading(null);
      await loadSubmissions();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment._id === selectedId) ?? null,
    [assessments, selectedId]
  );

  if (grading) {
    const pending = grading.answers.filter((answer) => answer.isCorrect === null);
    return (
      <div>
        <div className="page-header">
          <div className="page-header-title">
            <h2>Grade submission</h2>
          </div>
          <div className="page-header-actions">
            <Button variant="ghost" onClick={() => setGrading(null)}>Back to list</Button>
          </div>
        </div>

        <div className="card card-pad">
          {pending.length === 0 ? (
            <p className="text-muted">This answer sheet is fully auto-graded. Use manual feedback if needed.</p>
          ) : (
            <div className="flex flex-col" style={{ gap: 16 }}>
              {pending.map((answer) => (
                <div key={answer.questionId} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <p className="text-sm" style={{ fontWeight: 600, margin: '0 0 6px' }}>{answer.prompt}</p>
                  <p className="text-xs text-muted" style={{ margin: '0 0 6px' }}>
                    Student answer: {typeof answer.answer === 'string' ? answer.answer : JSON.stringify(answer.answer)}
                  </p>
                  <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Awarded marks (max {answer.marks})</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={answer.marks}
                    value={grading.marks[answer.questionId] ?? 0}
                    onChange={(e) => setGrading((prev) => (prev ? { ...prev, marks: { ...prev.marks, [answer.questionId]: Number(e.target.value) } } : prev))}
                    style={{ maxWidth: 140 }}
                  />
                </div>
              ))}
            </div>
          )}
          <label className="text-xs text-muted" style={{ display: 'block', marginTop: 16, marginBottom: 4 }}>Feedback</label>
          <textarea className="textarea" rows={3} value={grading.feedback} onChange={(e) => setGrading((prev) => (prev ? { ...prev, feedback: e.target.value } : prev))} />
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={() => void saveGrading()} loading={saving}>Save grades</Button>
            <Button variant="ghost" onClick={() => setGrading(null)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Submissions &amp; Grading</h2>
          <span className="text-sm text-muted">Review and grade student answer sheets</span>
        </div>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : assessments.length === 0 ? (
            <EmptyState title="No assessments yet" description="Publish an assessment first, then wait for submissions." />
          ) : (
            assessments.map((assessment) => (
              <button
                key={assessment._id}
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  border: '1px solid var(--border-color)',
                  background: assessment._id === selectedId ? 'var(--bg-active)' : 'var(--bg-surface)',
                  padding: '10px 12px',
                }}
                onClick={() => setSelectedId(assessment._id)}
              >
                <span style={{ display: 'block', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{assessment.title}</span>
                <span className="text-xs text-muted">
                  Class {assessment.classLevel} • {assessment.subject}
                  {assessment.pendingGrading ? ` • ${assessment.pendingGrading} pending` : ''}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="card">
          {selectedAssessment ? (
            submissions.length === 0 ? (
              <EmptyState title="No submissions" description="Students haven't submitted this assessment yet." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>%</th>
                      <th>Needs grading</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission) => (
                      <tr key={submission._id}>
                        <td>
                          <div className="font-semibold">{submission.student?.name ?? 'Unknown student'}</div>
                          <div className="text-xs text-muted">{submission.student?.email}</div>
                        </td>
                        <td>{submission.status}</td>
                        <td>{submission.totalScore} / {submission.totalMarks}</td>
                        <td>{submission.percentage}%</td>
                        <td>{submission.needsGrading ? <Badge variant="warning">Yes</Badge> : <Badge variant="success">No</Badge>}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Button size="sm" variant={submission.needsGrading ? 'primary' : 'ghost'} onClick={() => void startGrading(submission._id)}>
                            {submission.needsGrading ? 'Grade' : 'View'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <EmptyState title="Select an assessment" description="Pick an assessment from the list to see submissions." />
          )}
        </div>
      </div>
    </div>
  );
}
