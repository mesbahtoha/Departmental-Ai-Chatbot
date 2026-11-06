import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdAdd, MdDelete, MdLink, MdDescription } from 'react-icons/md';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMaterials, createMaterial, deleteMaterial, type MaterialItem } from '@/lib/api-v1';
import { CLASS_LEVELS, MATERIAL_TYPES } from '@/constants/academic';
import { getErrorMessage } from '@/lib/api';

const INITIAL_FORM = {
  title: '',
  description: '',
  type: 'note',
  classLevel: 3,
  subject: '',
  chapter: '',
  externalUrl: '',
  textContent: '',
};

export function TeacherMaterials() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listMaterials({ mine: 'true' });
      // Some staff members may not have a school; fall back to everything visible.
      setMaterials(payload.materials);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.title.trim() || !form.subject.trim()) {
      setFormError('Title and subject are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createMaterial({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        classLevel: Number(form.classLevel),
        subject: form.subject.trim(),
        chapter: form.chapter.trim() || undefined,
        externalUrl: form.externalUrl.trim() || undefined,
        textContent: form.textContent.trim() || undefined,
      });
      toast.success('Material published');
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      await load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      await deleteMaterial(id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>My Materials</h2>
          <span className="text-sm text-muted">Notes, exam sheets, syllabus and worksheets</span>
        </div>
        <div className="page-header-actions">
          <Button onClick={() => setCreateOpen(true)}><MdAdd size={18} /> Add material</Button>
        </div>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      <div className="card">
        {loading ? (
          <p className="text-muted" style={{ padding: 20 }}>Loading…</p>
        ) : materials.length === 0 ? (
          <EmptyState
            icon={<MdDescription size={40} />}
            title="No materials yet"
            description="Publish notes, exam sheets and syllabus content for your students."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Downloads</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material._id}>
                    <td>
                      <div className="font-semibold">{material.title}</div>
                      {material.chapter && <div className="text-xs text-muted">{material.chapter}</div>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{material.type.replace(/_/g, ' ')}</td>
                    <td>Class {material.classLevel}</td>
                    <td>{material.subject}</td>
                    <td>{material.downloadCount ?? 0}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {material.externalUrl && (
                        <a className="btn btn-ghost btn-sm" href={material.externalUrl} target="_blank" rel="noreferrer" aria-label="Open link">
                          <MdLink size={16} />
                        </a>
                      )}{' '}
                      <Button size="sm" variant="ghost" onClick={() => {
                        const win = window.open('', '_blank', 'height=600,width=800');
                        if (win) {
                          win.document.write(`<pre style="white-space:pre-wrap;font-family:system-ui;padding:16px">${material.textContent ?? ''}</pre>`);
                        }
                      }}>View</Button>{' '}
                      <Button size="sm" variant="ghost" onClick={() => void onDelete(material._id)} aria-label="Delete material">
                        <MdDelete size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add study material">
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 3 - algebraic expressions" />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {MATERIAL_TYPES.map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
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
            <Field label="Subject">
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" />
            </Field>
            <Field label="Chapter (optional)">
              <Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
            </Field>
            <Field label="External link (optional)">
              <Input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Note / exam-sheet content">
            <Textarea rows={6} value={form.textContent} onChange={(e) => setForm({ ...form, textContent: e.target.value })} placeholder="Paste the note or exam sheet text here…" />
          </Field>
          <Field label="Description (optional)">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          {formError && <div className="card form-error-card"><span className="text-sm text-danger">{formError}</span></div>}
          <div className="flex items-center gap-2">
            <Button onClick={() => void submit()} loading={saving}>Publish material</Button>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
