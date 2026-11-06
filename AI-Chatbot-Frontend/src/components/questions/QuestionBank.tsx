import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { listQuestions, deleteQuestion, duplicateQuestion } from '@/lib/api-v1';
import { QUESTION_TYPES, CLASS_LEVELS } from '@/constants/academic';
import { QuestionForm } from '@/components/questions/QuestionForm';
import type { Question } from '@/types';

interface QuestionBankProps {
  mode: 'admin' | 'school' | 'teacher';
}

const TYPE_SHORT: Record<string, string> = Object.fromEntries(QUESTION_TYPES.map((t) => [t.key, t.shortLabel]));

export function QuestionBank({ mode }: QuestionBankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [classLevel, setClassLevel] = useState<number | undefined>(undefined);
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState<'true' | 'false' | 'all'>('all');
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; question: Question } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listQuestions({
        classLevel,
        subject: subject || undefined,
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
        mine,
        page,
        limit: 50,
      });
      setQuestions(payload.questions ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [page, classLevel, subject, type, status, search, mine]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this question?')) return;
    setActionError('');
    try {
      await deleteQuestion(id);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete question');
    }
  };

  const onDuplicate = async (question: Question) => {
    try {
      await duplicateQuestion(question._id, question.classLevel);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate question');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}
      <div className="card card-pad flex flex-wrap items-end gap-3">
        <div style={{ minWidth: 160 }}>
          <Field label="Class">
            <Select value={classLevel ? String(classLevel) : ''} onChange={(e) => { setClassLevel(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}>
              <option value="">All classes</option>
              {CLASS_LEVELS.map((level) => (
                <option key={level} value={level}>Class {level}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div style={{ minWidth: 160 }}>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }} placeholder="Subject" />
          </Field>
        </div>
        <div style={{ minWidth: 160 }}>
          <Field label="Type">
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div style={{ minWidth: 150 }}>
          <Field label="Status">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
        <div style={{ minWidth: 180 }}>
          <Field label="Search">
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Prompt / tag…" />
          </Field>
        </div>
        {mode === 'teacher' && (
          <div style={{ minWidth: 140 }}>
            <Field label="Scope">
              <Select value={mine} onChange={(e) => { setMine(e.target.value as 'true' | 'false' | 'all'); setPage(1); }}>
                <option value="all">All (shared bank)</option>
                <option value="true">Created by me</option>
              </Select>
            </Field>
          </div>
        )}
        <div style={{ marginLeft: 'auto' }} className="flex items-end gap-2">
          <Button onClick={() => setModal({ mode: 'create' })}>+ New question</Button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Class</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Subject</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Prompt</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Marks</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Difficulty</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center text-muted" style={{ padding: 24 }}>Loading…</td></tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<span style={{ fontSize: 40 }}>🧠</span>}
                      title="No questions found"
                      description="Create the first question for this class and subject."
                    />
                  </td>
                </tr>
              ) : (
                questions.map((question) => (
                  <tr key={question._id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px' }}>Class {question.classLevel}</td>
                    <td style={{ padding: '10px 12px' }}>{question.subject}</td>
                    <td style={{ padding: '10px 12px' }}>{TYPE_SHORT[question.type] ?? question.type}</td>
                    <td style={{ padding: '10px 12px', maxWidth: 340 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{question.prompt}</div>
                      {question.explanation && <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{question.explanation}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{question.marks}</td>
                    <td style={{ padding: '10px 12px' }}>{question.difficulty}</td>
                    <td style={{ padding: '10px 12px' }}>{question.status}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ mode: 'edit', question })}>Edit</Button>{' '}
                      <Button size="sm" variant="ghost" onClick={() => void onDuplicate(question)}>Duplicate</Button>{' '}
                      <Button size="sm" variant="danger" onClick={() => void onDelete(question._id)}>Delete</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>{total} question(s)</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
          <span>Page {page}</span>
          <Button size="sm" variant="ghost" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      {modal?.mode === 'create' && (
        <Modal open onClose={() => setModal(null)} title="Create question">
          <QuestionForm
            onSaved={async () => {
              setModal(null);
              setSaving(false);
              await load();
            }}
            saving={saving}
            defaultClassLevel={classLevel}
          />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal open onClose={() => setModal(null)} title="Edit question">
          <QuestionForm
            initial={modal.question}
            onSaved={async () => {
              setModal(null);
              setSaving(false);
              await load();
            }}
            saving={saving}
            defaultClassLevel={classLevel}
          />
        </Modal>
      )}
      {actionError && <div className="card form-error-card"><span className="text-sm text-danger">{actionError}</span></div>}
    </div>
  );
}
