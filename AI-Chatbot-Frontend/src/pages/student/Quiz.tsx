import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { getAssessmentForStudent, submitAssessment } from '@/lib/api-v1';
import { getErrorMessage } from '@/lib/api';
import type { Assessment, AssessmentItem, Question } from '@/types';

function renderQuestion(
  item: AssessmentItem,
  answers: Record<string, unknown>,
  setAnswer: (questionId: string, value: unknown) => void
) {
  const question = item.question;
  const qid = question._id;
  const answer = answers[qid];

  switch (question.type) {
    case 'single_mcq':
    case 'passage_mcq':
    case 'choose_correct_word':
    case 'synonyms_antonyms':
    case 'math_symbol':
    case 'geometry_identify': {
      return (
        <div className="flex flex-col" style={{ gap: 6 }}>
          {(question.options ?? []).map((option) => (
            <label key={option.key} className="flex items-center gap-2" style={{ padding: '6px 0' }}>
              <input
                type="radio"
                name={`q-${qid}`}
                checked={answer === option.key}
                onChange={() => setAnswer(qid, option.key)}
              />
              <span>{option.key}. {option.text}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'multi_mcq': {
      const selected = Array.isArray(answer) ? (answer as string[]) : [];
      return (
        <div className="flex flex-col" style={{ gap: 6 }}>
          {(question.options ?? []).map((option) => (
            <label key={option.key} className="flex items-center gap-2" style={{ padding: '6px 0' }}>
              <input
                type="checkbox"
                checked={selected.includes(option.key)}
                onChange={(e) => setAnswer(qid, e.target.checked ? [...selected, option.key] : selected.filter((key) => key !== option.key))}
              />
              <span>{option.key}. {option.text}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'true_false': {
      return (
        <div className="flex items-center gap-3">
          {(['true', 'false'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name={`q-${qid}`} checked={answer === value} onChange={() => setAnswer(qid, value)} />
              <span style={{ textTransform: 'capitalize' }}>{value}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'matching':
    case 'ict_classification':
    case 'science_formula_unit':
    case 'history_geo_match': {
      const pairs = question.pairs ?? [];
      const mapping = (answer ?? {}) as Record<string, string>;
      const rights = pairs.map((pair) => pair.right).filter(Boolean);
      return (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {pairs.map((pair, index) => (
            <div key={index} className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <span className="text-sm" style={{ minWidth: 180 }}>{pair.left}</span>
              <Select value={mapping[pair.left ?? ''] ?? ''} onChange={(e) => setAnswer(qid, { ...mapping, [pair.left ?? '']: e.target.value })} style={{ minWidth: 160 }}>
                <option value="">Choose match…</option>
                {rights.map((right) => (
                  <option key={right} value={right}>{right}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      );
    }

    case 'fill_blanks_clue':
    case 'fill_blanks_no_clue':
    case 'grammar_application': {
      const blanks = question.blanks ?? [];
      const current = (answer ?? {}) as Record<string, string>;
      return (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {blanks.map((blank, index) => (
            <label key={index} className="flex items-center gap-2">
              <span className="text-sm" style={{ minWidth: 24 }}>[{blank.index ?? index + 1}]</span>
              <Input
                value={current[String(blank.index ?? index + 1)] ?? ''}
                onChange={(e) => setAnswer(qid, { ...current, [String(blank.index ?? index + 1)]: e.target.value })}
                placeholder={blank.clue ? `Clue: ${blank.clue}` : 'Fill the blank'}
              />
            </label>
          ))}
        </div>
      );
    }

    case 'diagram_label': {
      const labels = question.labels ?? [];
      const current = (answer ?? {}) as Record<string, string>;
      return (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {labels.map((label, index) => (
            <label key={index} className="flex items-center gap-2">
              <span className="text-sm" style={{ minWidth: 120 }}>{label.label}</span>
              <Input
                value={current[label.label ?? String(index)] ?? ''}
                onChange={(e) => setAnswer(qid, { ...current, [label.label ?? String(index)]: e.target.value })}
                placeholder="Label"
              />
            </label>
          ))}
        </div>
      );
    }

    case 'table_completion': {
      return <Textarea rows={4} value={typeof answer === 'string' ? answer : ''} onChange={(e) => setAnswer(qid, e.target.value)} placeholder="Complete the table values (JSON or plain text)" />;
    }

    default: {
      return (
        <Input
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => setAnswer(qid, e.target.value)}
          placeholder="Your answer…"
        />
      );
    }
  }
}

export function StudentQuiz() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ totalScore: number; percentage: number; needsGrading: boolean; totalMarks: number } | null>(null);

  const load = useCallback(async () => {
    if (!assessmentId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getAssessmentForStudent(assessmentId);
      setAssessment(payload.assessment);
      if (payload.submission) {
        toast('You already submitted this assessment.');
        navigate('/student', { replace: true });
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [assessmentId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Wire up the question count only after hydration completes.
  const items = assessment?.items ?? [];
  const answeredCount = useMemo(
    () => items.filter((item) => answers[item.question._id] !== undefined).length,
    [items, answers]
  );

  const submit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    try {
      const payload = items.map((item) => ({ question: item.question._id, answer: answers[item.question._id] ?? null }));
      const submission = await submitAssessment(assessment._id, payload, new Date().toISOString());
      setResult({
        totalScore: submission.totalScore,
        percentage: submission.percentage ?? 0,
        needsGrading: submission.needsGrading,
        totalMarks: submission.totalMarks,
      });
      toast.success('Submitted!');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <p className="text-muted">Loading assessment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card form-error-card" style={{ margin: 16 }}>
        <p className="text-sm text-danger">{error}</p>
        <Button variant="ghost" onClick={() => navigate('/student')}>Back to my learning</Button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 24, maxWidth: 560, margin: '24px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>{result.needsGrading ? '📝' : '🎉'}</div>
        <h2 style={{ margin: '8px 0' }}>Submission received!</h2>
        <p className="text-sm text-muted">{assessment?.title}</p>
        <p className="text-lg" style={{ margin: '12px 0' }}>
          {result.totalScore} / {result.totalMarks} marks ({result.percentage}%)
        </p>
        {result.needsGrading && <Badge variant="warning">Some answers need teacher grading</Badge>}
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={() => navigate('/student')}>Back to my learning</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>{assessment?.title}</h2>
          <p className="text-sm text-muted">Class {assessment?.classLevel} • {assessment?.subject} • {assessment?.type}</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/student')}>Cancel</Button>
      </div>

      {assessment?.instructions && (
        <div className="card card-pad" style={{ background: 'var(--bg-surface)' }}>
          <p className="text-sm" style={{ margin: 0, whiteSpace: 'pre-line' }}>{assessment.instructions}</p>
        </div>
      )}

      <p className="text-sm text-muted" style={{ margin: '12px 0' }}>{answeredCount} / {items.length} questions answered</p>

      {items.map((item, index) => {
        const question = item.question as Question;
        return (
          <div key={question._id} className="card card-pad" style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between" style={{ gap: 12 }}>
              <p className="font-semibold" style={{ margin: 0 }}>
                {index + 1}. {question.prompt}
              </p>
              <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{item.marks} mark{item.marks === 1 ? '' : 's'}</span>
            </div>
            {question.passage && <p className="text-sm" style={{ margin: '10px 0 0' }}>{question.passage}</p>}
            {question.instructions && <p className="text-xs text-muted" style={{ margin: '6px 0 0' }}>{question.instructions}</p>}
            <div style={{ marginTop: 12 }}>{renderQuestion(item, answers, (id, value) => setAnswers((prev) => ({ ...prev, [id]: value })))}</div>
          </div>
        );
      })}

      <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
        <span className="text-sm text-muted">All unsaved answers will be evaluated on submit.</span>
        <Button onClick={() => void submit()} loading={submitting}>Submit answers</Button>
      </div>
    </div>
  );
}
