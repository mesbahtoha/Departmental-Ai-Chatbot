import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaPlus } from 'react-icons/fa';
import { MdDelete } from 'react-icons/md';
import { apiDelete, apiGet, apiPost, apiPut, getErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Field, Input, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { formatDate } from '@/lib/format';
import type { PromptTemplate } from '@/types';

export function AdminPromptTemplates() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiGet<{ templates: PromptTemplate[] }>('/api/v1/admin/prompt-templates');
      setTemplates(payload.templates ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim() || !content.trim()) {
      toast.error('Name, key and content are required');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/v1/admin/prompt-templates', {
        name: name.trim(),
        key: key.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: description.trim() || undefined,
        content: content.trim(),
      });
      toast.success('Template created');
      setCreateOpen(false);
      setName('');
      setKey('');
      setDescription('');
      setContent('');
      void load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: PromptTemplate) => {
    try {
      await apiPut(`/api/v1/admin/prompt-templates/${template._id}`, { isActive: !template.isActive });
      toast.success('Template updated');
      void load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const remove = async (template: PromptTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      await apiDelete(`/api/v1/admin/prompt-templates/${template._id}`);
      toast.success('Template deleted');
      void load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const selectForEditing = (template: PromptTemplate) => {
    setName(template.name);
    setKey(template.key);
    setDescription(template.description ?? '');
    setContent(template.content);
    setCreateOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 2 }}>Prompt templates</h2>
          <span className="text-sm text-muted">Personas and instructions for the assistant</span>
        </div>
        <Button onClick={() => setCreateOpen(true)}><FaPlus /> New template</Button>
      </div>

      {loading ? (
        <FullPageSpinner label="Loading templates…" />
      ) : templates.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FaPlus />}
            title="No templates yet"
            description="Create prompt templates to control how the assistant behaves."
          />
        </div>
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {templates.map((template) => (
            <div key={template._id} className="card card-pad flex flex-col" style={{ gap: 10 }}>
              <div className="flex items-center justify-between">
                <div className="font-semibold" style={{ fontSize: 15 }}>{template.name}</div>
                <div className="flex items-center" style={{ gap: 6 }}>
                  {template.isDefault && <Badge variant="primary">default</Badge>}
                  <Badge variant={template.isActive ? 'success' : 'muted'}>
                    {template.isActive ? 'active' : 'inactive'}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted">{template.key}</div>
              {template.description && (
                <div className="text-sm text-secondary">{template.description}</div>
              )}
              <div
                className="text-sm"
                style={{
                  background: 'var(--bg-surface-2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  maxHeight: 120,
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              >
                {template.content}
              </div>
              <div className="flex items-center justify-between mt-auto">
                <Toggle checked={template.isActive} onChange={() => void toggleActive(template)} label="Active" />
                <div className="flex items-center" style={{ gap: 6 }}>
                  <Button size="sm" variant="ghost" onClick={() => selectForEditing(template)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(template)}>
                    <MdDelete size={14} />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted">Created {formatDate(template.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Prompt template">
        <form onSubmit={(e) => void create(e)}>
          <Field label="Name" hint="e.g. Campus Guide">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Key" hint="lowercase-letters-and-dashes">
            <Input
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="campus-guide"
            />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Prompt content" hint="The system instruction sent to the AI">
            <Textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={7} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save template</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
