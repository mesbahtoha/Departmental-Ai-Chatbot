import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { QUESTION_TYPES } from '@/constants/academic';
import { createQuestion, duplicateQuestion, importQuestions, updateQuestion } from '@/lib/api-v1';
import type { Question, QuestionInput } from '@/types';

interface QuestionFormProps {
  /** When set, the form edits this question; otherwise it creates a new one. */
  initial?: Question | null;
  onSaved?: (question: Question) => void;
  onCancel?: () => void;
  saving?: boolean;
  /** Pre-select the class level (e.g. when created from a class-scoped context). */
  defaultClassLevel?: number;
}

const EMPTY_FORM = {
  classLevel: 3,
  subject: '',
  chapter: '',
  topic: '',
  type: 'single_mcq',
  prompt: '',
  passage: '',
  instructions: '',
  marks: 1,
  difficulty: 'medium',
  tags: '',
  isPublic: false,
  status: 'published',
  answerText: '',
  explanation: '',
};

interface OptionDraft {
  key: string;
  text: string;
}

interface PairDraft {
  left: string;
  right: string;
}

interface BlankDraft {
  index: number;
  answer: string;
  clue: string;
}

interface LabelDraft {
  label: string;
  answer: string;
  x: number;
  y: number;
}

export function QuestionForm({ initial, onSaved, onCancel, saving, defaultClassLevel }: QuestionFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [options, setOptions] = useState<OptionDraft[]>([{ key: 'A', text: '' }]);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [pairs, setPairs] = useState<PairDraft[]>([{ left: '', right: '' }]);
  const [blanks, setBlanks] = useState<BlankDraft[]>([{ index: 0, answer: '', clue: '' }]);
  const [labels, setLabels] = useState<LabelDraft[]>([{ label: '', answer: '', x: 0, y: 0 }]);
  const [tableData, setTableData] = useState('');
  const [error, setError] = useState('');
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (!initial) return;
    setForm({
      classLevel: initial.classLevel ?? defaultClassLevel ?? 3,
      subject: initial.subject ?? '',
      chapter: initial.chapter ?? '',
      topic: initial.topic ?? '',
      type: initial.type ?? 'single_mcq',
      prompt: initial.prompt ?? '',
      passage: initial.passage ?? '',
      instructions: initial.instructions ?? '',
      marks: initial.marks ?? 1,
      difficulty: initial.difficulty ?? 'medium',
      tags: (initial.tags ?? []).join(', '),
      isPublic: Boolean(initial.isPublic),
      status: initial.status ?? 'published',
      answerText: initial.answerText ?? '',
      explanation: initial.explanation ?? '',
    });
    setOptions((initial.options ?? [{ key: 'A', text: '' }]).map((o) => ({ key: o.key, text: o.text ?? '' })));
    setCorrectAnswers(initial.correctAnswers ?? []);
    setPairs((initial.pairs ?? [{ left: '', right: '' }]).map((p) => ({ left: p.left ?? '', right: p.right ?? '' })));
    setBlanks((initial.blanks ?? [{ index: 0, answer: '', clue: '' }]).map((b) => ({ index: b.index ?? 0, answer: b.answer ?? '', clue: b.clue ?? '' })));
    setLabels((initial.labels ?? [{ label: '', answer: '', x: 0, y: 0 }]).map((l) => ({ label: l.label ?? '', answer: l.answer ?? '', x: l.x ?? 0, y: l.y ?? 0 })));
    setTableData(initial.tableData ? JSON.stringify(initial.tableData, null, 2) : '');
  }, [initial, defaultClassLevel]);

  const typeMeta = QUESTION_TYPES.find((t) => t.key === form.type);
  const answerMode = typeMeta?.answerMode ?? 'options';

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const input: QuestionInput = {
      classLevel: Number(form.classLevel),
      subject: form.subject.trim(),
      chapter: form.chapter?.trim() || undefined,
      topic: form.topic?.trim() || undefined,
      type: form.type,
      prompt: form.prompt.trim(),
      passage: form.passage?.trim() || undefined,
      instructions: form.instructions?.trim() || undefined,
      options: answerMode === 'options' ? options.filter((o) => o.text.trim()) : undefined,
      correctAnswers: answerMode === 'options' ? correctAnswers : undefined,
      pairs: answerMode === 'pairs' ? pairs.filter((p) => p.left.trim() || p.right.trim()) : undefined,
      blanks: answerMode === 'blanks' ? blanks.filter((b) => b.answer.trim()) : undefined,
      labels: answerMode === 'labels' ? labels.filter((l) => l.answer.trim()) : undefined,
      tableData: answerMode === 'table' ? (tableData ? JSON.parse(tableData) : null) : undefined,
      answerText: answerMode === 'text' ? form.answerText.trim() || undefined : undefined,
      explanation: form.explanation?.trim() || undefined,
      marks: Number(form.marks) || 0,
      difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      isPublic: form.isPublic,
      status: form.status as 'draft' | 'published' | 'archived',
    };

    try {
      const saved = initial ? await updateQuestion(initial._id, input) : await createQuestion(input);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the question');
    }
  };

  const handleDuplicate = async () => {
    if (!initial) return;
    try {
      const copy = await duplicateQuestion(initial._id, form.classLevel);
      onSaved?.(copy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate the question');
    }
  };

  const handleImport = async () => {
    setError('');
    try {
      const parsed = JSON.parse(importText);
      const created = await importQuestions(parsed as QuestionInput[]);
      onSaved?.(created.questions[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import questions');
    }
  };

  const addOption = () => setOptions((prev) => [...prev, { key: String.fromCharCode(65 + prev.length), text: '' }]);
  const removeOption = (index: number) => setOptions((prev) => prev.filter((_, i) => i !== index));
  const toggleCorrect = (key: string) => {
    setCorrectAnswers((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Class">
          <Select value={String(form.classLevel)} onChange={(e) => set('classLevel', Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
              <option key={level} value={level}>Class {level}</option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. English" required />
        </Field>
        <Field label="Chapter / Topic">
          <Input value={form.chapter} onChange={(e) => set('chapter', e.target.value)} placeholder="Chapter" />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Marks">
          <Input type="number" min={0} max={1000} value={form.marks} onChange={(e) => set('marks', Number(e.target.value))} />
        </Field>
        <Field label="Difficulty">
          <Select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>
      </div>

      <Field label="Question prompt">
        <Textarea rows={3} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} required />
      </Field>
      {form.type === 'passage_mcq' && (
        <Field label="Passage / common information">
          <Textarea rows={4} value={form.passage} onChange={(e) => set('passage', e.target.value)} />
        </Field>
      )}
      <Field label="Instructions (optional)">
        <Textarea rows={2} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
      </Field>

      {answerMode === 'options' && (
        <div className="card card-pad" style={{ background: 'var(--bg-surface)' }}>
          <div className="font-semibold mb-2" style={{ fontSize: 14 }}>Options</div>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Input
                style={{ maxWidth: 70 }}
                value={option.key}
                onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, key: e.target.value } : o)))}
              />
              <Input
                className="flex-1"
                value={option.text}
                onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))}
                placeholder={`Option ${option.key}`}
              />
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeOption(index)} aria-label="Remove option">
                ×
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={addOption}>
            + Add option
          </Button>
          <div className="text-sm text-muted mt-2">
            Correct answer(s):{' '}
            {options
              .filter((o) => o.text.trim())
              .map((o) => (
                <label key={o.key} className="mr-3">
                  <input type="checkbox" checked={correctAnswers.includes(o.key)} onChange={() => toggleCorrect(o.key)} /> {o.key}. {o.text}
                </label>
              ))}
          </div>
          {form.type === 'true_false' && (
            <div className="text-sm text-muted mt-2">
              Correct value:{' '}
              <label className="mr-3">
                <input type="radio" name="tf" checked={correctAnswers.includes('true')} onChange={() => setCorrectAnswers(['true'])} /> True
              </label>
              <label>
                <input type="radio" name="tf" checked={correctAnswers.includes('false')} onChange={() => setCorrectAnswers(['false'])} /> False
              </label>
            </div>
          )}
        </div>
      )}

      {answerMode === 'pairs' && (
        <div className="card card-pad" style={{ background: 'var(--bg-surface)' }}>
          <div className="font-semibold mb-2" style={{ fontSize: 14 }}>Pairs (left ↔ right)</div>
          {pairs.map((pair, index) => (
            <div key={index} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Input value={pair.left} onChange={(e) => setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, left: e.target.value } : p)))} placeholder="Left" />
              <span>↔</span>
              <Input value={pair.right} onChange={(e) => setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, right: e.target.value } : p)))} placeholder="Right" />
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPairs((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove pair">
                ×
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setPairs((prev) => [...prev, { left: '', right: '' }])}>
            + Add pair
          </Button>
        </div>
      )}

      {answerMode === 'blanks' && (
        <div className="card card-pad" style={{ background: 'var(--bg-surface)' }}>
          <div className="font-semibold mb-2" style={{ fontSize: 14 }}>Blanks (answer + clue)</div>
          {blanks.map((blank, index) => (
            <div key={index} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Input type="number" min={0} value={blank.index} onChange={(e) => setBlanks((prev) => prev.map((b, i) => (i === index ? { ...b, index: Number(e.target.value) } : b)))} style={{ maxWidth: 70 }} />
              <Input value={blank.answer} onChange={(e) => setBlanks((prev) => prev.map((b, i) => (i === index ? { ...b, answer: e.target.value } : b)))} placeholder="Answer" />
              <Input value={blank.clue} onChange={(e) => setBlanks((prev) => prev.map((b, i) => (i === index ? { ...b, clue: e.target.value } : b)))} placeholder="Clue (optional)" />
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setBlanks((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove blank">
                ×
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setBlanks((prev) => [...prev, { index: prev.length, answer: '', clue: '' }])}>
            + Add blank
          </Button>
        </div>
      )}

      {answerMode === 'labels' && (
        <div className="card card-pad" style={{ background: 'var(--bg-surface)' }}>
          <div className="font-semibold mb-2" style={{ fontSize: 14 }}>Diagram labels</div>
          {labels.map((label, index) => (
            <div key={index} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Input value={label.label} onChange={(e) => setLabels((prev) => prev.map((l, i) => (i === index ? { ...l, label: e.target.value } : l)))} placeholder="Label" />
              <Input value={label.answer} onChange={(e) => setLabels((prev) => prev.map((l, i) => (i === index ? { ...l, answer: e.target.value } : l)))} placeholder="Answer" />
              <Input type="number" value={label.x} onChange={(e) => setLabels((prev) => prev.map((l, i) => (i === index ? { ...l, x: Number(e.target.value) } : l)))} placeholder="X" style={{ maxWidth: 70 }} />
              <Input type="number" value={label.y} onChange={(e) => setLabels((prev) => prev.map((l, i) => (i === index ? { ...l, y: Number(e.target.value) } : l)))} placeholder="Y" style={{ maxWidth: 70 }} />
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setLabels((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove label">
                ×
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLabels((prev) => [...prev, { label: '', answer: '', x: 0, y: 0 }])}>
            + Add label
          </Button>
        </div>
      )}

      {answerMode === 'table' && (
        <Field label="Table / chart data (JSON)">
          <Textarea rows={6} value={tableData} onChange={(e) => setTableData(e.target.value)} placeholder='{"headers": ["Item", "Value"], "rows": [["A", "1"]]}' />
        </Field>
      )}

      {answerMode === 'text' && (
        <Field label="Correct answer (one word / sentence)">
          <Input value={form.answerText} onChange={(e) => set('answerText', e.target.value)} />
        </Field>
      )}

      <Field label="Explanation (optional)">
        <Textarea rows={2} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" loading={saving}>
          {initial ? 'Save changes' : 'Create question'}
        </Button>
        {initial && (
          <Button type="button" variant="ghost" onClick={() => void handleDuplicate()} disabled={saving}>
            Duplicate
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      {!initial && (
        <div className="card card-pad" style={{ background: 'var(--bg-surface)' }}>
          <div className="font-semibold mb-2" style={{ fontSize: 14 }}>Bulk import (JSON array of questions)</div>
          <Textarea rows={6} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='[{"classLevel":3,"subject":"English","type":"single_mcq","prompt":"...","options":[{"key":"A","text":"..."}],"correctAnswers":["..."]}]' />
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleImport()} disabled={saving}>
            Import
          </Button>
        </div>
      )}
    </form>
  );
}
