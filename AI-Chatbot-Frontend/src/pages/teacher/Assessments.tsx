import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { listAssessments, publishAssessment, closeAssessment, deleteAssessment } from '@/lib/api-v1';
import { CreateAssessmentModal } from '@/components/assessments/CreateAssessmentModal';
import type { Assessment } from '@/types';
import { getErrorMessage } from '@/lib/api';

export function TeacherAssessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listAssessments({ page: 1, limit: 100 });
      setAssessments(payload.assessments ?? []);
      setTotal(payload.total ?? 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async (id: string) => {
    setBusy(id);
    try {
      await publishAssessment(id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const onClose = async (id: string) => {
    setBusy(id);
    try {
      await closeAssessment(id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this assessment?')) return;
    try {
      await deleteAssessment(id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Assessments</h2>
          <span className="text-sm text-muted">{total} total assessments</span>
        </div>
        <div className="page-header-actions">
          <CreateAssessmentModal onCreated={() => void load()} />
        </div>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      <div className="card">
        {loading ? (
          <p className="text-muted" style={{ padding: 20 }}>Loading…</p>
        ) : assessments.length === 0 ? (
          <EmptyState icon={<span style={{ fontSize: 40 }}>📝</span>} title="No assessments yet" description="Create a quiz / assignment / exam from the question bank." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a._id}>
                    <td className="font-semibold">{a.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.type}</td>
                    <td>Class {a.classLevel}</td>
                    <td>{a.subject}</td>
                    <td><Badge variant={a.status === 'published' ? 'success' : 'muted'}>{a.status}</Badge></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {a.status === 'draft' && <Button size="sm" variant="secondary" disabled={busy === a._id} onClick={() => void onPublish(a._id)}>Publish</Button>}{' '}
                      {a.status !== 'closed' && <Button size="sm" variant="ghost" disabled={busy === a._id} onClick={() => void onClose(a._id)}>Close</Button>}{' '}
                      <Button size="sm" variant="ghost" onClick={() => void onDelete(a._id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
