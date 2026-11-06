import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdAdd } from 'react-icons/md';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { createAssessment, listQuestionSets } from '@/lib/api-v1';
import { ASSESSMENT_TYPES, CLASS_LEVELS, ASSESSMENT_STATUSES } from '@/constants/academic';
import { getErrorMessage } from '@/lib/api';
import type { QuestionSet } from '@/types';

interface CreateAssessmentModalProps {
  onCreated?: () => void;
}

export function CreateAssessmentModal({ onCreated }: CreateAssessmentModalProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [form, setForm] = useState({
    type: 'quiz',
    title: '',
    instructions: '',
    classLevel: 3,
    subject: '',
    questionSetId: '',
    durationMinutes: 10,
    maxAttempts: 1,
    status: 'published',
  });

  const loadSets = useCallback(async () => {
    setLoadingSets(true);
    try {
      const payload = await listQuestionSets({ classLevel: form.classLevel, ...(form.subject.trim() ? { subject: form.subject.trim() } : {}), limit: 100 });
      setSets(payload.sets ?? []);
    } catch {
      setSets([]);
    } finally {
      setLoadingSets(false);
    }
  }, [form.classLevel, form.subject]);

  useEffect(() => {
    if (open) void loadSets();
  }, [open, loadSets]);

  const submit = async () => {
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!form.questionSetId) {
      setFormError('Pick a question set (create one first in the question-set library)');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await createAssessment({
        type: form.type,
        title: form.title.trim(),
        instructions: form.instructions.trim() || undefined,
        classLevel: Number(form.classLevel),
        subject: form.subject.trim(),
        questionSetId: form.questionSetId,
        durationMinutes: Number(form.durationMinutes) || 0,
        maxAttempts: Number(form.maxAttempts) || 1,
        status: form.status as 'draft' | 'published' | 'closed',
      });
      toast.success(`Assessment "${created.title}" ${form.status === 'published' ? 'published' : 'saved as draft'}`);
      setOpen(false);
      setForm({ ...form, title: '', instructions: '', questionSetId: '' });
      onCreated?.();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><MdAdd size={18} /> New assessment</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Create assessment">
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {ASSESSMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </Field>
            <Field label="Class">
              <Select value={String(form.classLevel)} onChange={(e) => setForm({ ...form, classLevel: Number(e.target.value) })}>
                {CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>Class {level}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Algebra Quiz 1" />
          </Field>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Subject">
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" />
            </Field>
            <Field label="Question set">
              <Select value={form.questionSetId} onChange={(e) => setForm({ ...form, questionSetId: e.target.value })}>
                <option value="">{loadingSets ? 'Loading…' : sets.length ? 'Select question set' : 'No question sets for this class/subject'}</option>
                {sets.map((set) => (
                  <option key={set._id} value={set._id}>{set.name} ({set.questionCount} questions)</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Instructions (optional)">
            <Textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </Field>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Duration (minutes)">
              <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Max attempts">
              <Input type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {ASSESSMENT_STATUSES.filter((status) => status !== 'closed').map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </Field>
          </div>

          {formError && <div className="card form-error-card"><span className="text-sm text-danger">{formError}</span></div>}
          <div className="flex items-center gap-2">
            <Button onClick={() => void submit()} loading={saving}>Create assessment</Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
