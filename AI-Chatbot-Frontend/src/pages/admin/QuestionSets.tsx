import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { listQuestionSets, createQuestionSet, deleteQuestionSet, listQuestions } from '@/lib/api-v1';
import { CLASS_LEVELS } from '@/constants/academic';
import type { Question, QuestionSet } from '@/types';
import { getErrorMessage } from '@/lib/api';

export function AdminQuestionSets() {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classLevel, setClassLevel] = useState(3);
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listQuestionSets({ page: 1, limit: 50 });
      setSets(payload.sets ?? []);
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

  const openCreate = async () => {
    setName('');
    setDescription('');
    setClassLevel(3);
    setSubject('');
    setSelected([]);
    setFormError('');
    setQuestions([]);
    // Load candidate questions for the chosen class/subject.
    const payload = await listQuestions({ classLevel, subject: subject || undefined, limit: 100 });
    setQuestions(payload.questions ?? []);
    setCreateOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setFormError('');
    try {
      const items = selected.map((questionId) => {
        const q = questions.find((item) => item._id === questionId);
        return { question: questionId, marks: q?.marks ?? 1 };
      });
      const created = await createQuestionSet({
        name: name.trim(),
        description: description.trim(),
        classLevel,
        subject: subject.trim(),
        items,
        visibility: 'school',
        status: 'published',
      });
      toast.success(`Question set "${created.name}" created`);
      setCreateOpen(false);
      await load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this question set?')) return;
    try {
      await deleteQuestionSet(id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Question Sets</h2>
          <span className="text-sm text-muted">{total} total sets</span>
        </div>
        <div className="page-header-actions">
          <Button onClick={() => void openCreate()}>+ New question set</Button>
        </div>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      <div className="card">
        {loading ? (
          <p className="text-muted" style={{ padding: 20 }}>Loading…</p>
        ) : sets.length === 0 ? (
          <EmptyState icon={<span style={{ fontSize: 40 }}>🗂️</span>} title="No question sets yet" description="Group questions into reusable sets for quizzes, assignments and exams." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Questions</th>
                  <th>Marks</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((set) => (
                  <tr key={set._id}>
                    <td>
                      <div className="font-semibold">{set.name}</div>
                      {set.description && <div className="text-xs text-muted">{set.description}</div>}
                    </td>
                    <td>Class {set.classLevel}</td>
                    <td>{set.subject}</td>
                    <td>{set.questionCount ?? set.items?.length ?? 0}</td>
                    <td>{set.totalMarks ?? 0}</td>
                    <td><Badge variant={set.status === 'published' ? 'success' : 'muted'}>{set.status}</Badge></td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant="ghost" onClick={() => void onDelete(set._id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create question set">
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Algebra Basics" />
            </Field>
            <Field label="Class">
              <Select value={String(classLevel)} onChange={(e) => setClassLevel(Number(e.target.value))}>
                {CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>Class {level}</option>
                ))}
              </Select>
            </Field>
            <Field label="Subject">
              <Input value={subject} onChange={(e) => { setSubject(e.target.value); void openCreate(); }} placeholder="e.g. Mathematics" />
            </Field>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          <Field label="Questions (pick one or more)">
            <div className="card card-pad" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {questions.length === 0 ? (
                <p className="text-sm text-muted">No questions available for this class/subject yet.</p>
              ) : (
                questions.map((q) => (
                  <label key={q._id} className="flex items-center gap-2" style={{ padding: '6px 0', borderTop: '1px solid var(--border-color)' }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(q._id)}
                      onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, q._id] : prev.filter((id) => id !== q._id)))}
                    />
                    <span className="text-sm">{q.prompt}</span>
                    <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>Class {q.classLevel} • {q.marks} marks</span>
                  </label>
                ))
              )}
            </div>
          </Field>

          {formError && <div className="card form-error-card"><span className="text-sm text-danger">{formError}</span></div>}
          <div className="flex items-center gap-2">
            <Button onClick={() => void submit()} loading={saving}>Create set</Button>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
