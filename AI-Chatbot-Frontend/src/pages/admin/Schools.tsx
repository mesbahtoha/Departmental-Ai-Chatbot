import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { createSchool, deleteSchool, listSchools, updateSchool } from '@/lib/api-v1';
import { CLASS_LEVELS, SCHOOL_TYPES } from '@/constants/academic';
import type { SchoolSummary } from '@/types';

interface SchoolFormState {
  name: string;
  type: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  website: string;
  plan: string;
  maxTeachers: number;
  maxStudents: number;
  classLevels: number[];
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone: string;
}

const EMPTY_FORM: SchoolFormState = {
  name: '',
  type: 'school',
  email: '',
  phone: '',
  address: '',
  district: '',
  website: '',
  plan: 'free',
  maxTeachers: 50,
  maxStudents: 1000,
  classLevels: [...CLASS_LEVELS],
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPhone: '',
};

export function AdminSchools() {
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolSummary | null>(null);
  const [form, setForm] = useState<SchoolFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listSchools({ page: 1, limit: 50 });
      setSchools(payload.schools ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCredentials(null);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (school: SchoolSummary) => {
    setEditing(school);
    setForm({
      name: school.name,
      type: school.type,
      email: school.email ?? '',
      phone: school.phone ?? '',
      address: school.address ?? '',
      district: school.district ?? '',
      website: school.website ?? '',
      plan: school.plan ?? 'free',
      maxTeachers: school.maxTeachers ?? 50,
      maxStudents: school.maxStudents ?? 1000,
      classLevels: school.classLevels?.length ? [...school.classLevels] : [...CLASS_LEVELS],
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      adminPhone: '',
    });
    setCredentials(null);
    setFormError('');
    setModalOpen(true);
  };

  const toggleClass = (level: number) => {
    setForm((f) => ({
      ...f,
      classLevels: f.classLevels.includes(level) ? f.classLevels.filter((l) => l !== level) : [...f.classLevels, level].sort((a, b) => a - b),
    }));
  };

  const submit = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateSchool(editing._id, {
          name: form.name,
          type: form.type,
          email: form.email,
          phone: form.phone,
          address: form.address,
          district: form.district,
          website: form.website,
          plan: form.plan,
          maxTeachers: form.maxTeachers,
          maxStudents: form.maxStudents,
          classLevels: form.classLevels,
        });
        setModalOpen(false);
      } else {
        const created = await createSchool({
          name: form.name,
          type: form.type,
          email: form.email,
          phone: form.phone,
          address: form.address,
          district: form.district,
          website: form.website,
          plan: form.plan,
          maxTeachers: form.maxTeachers,
          maxStudents: form.maxStudents,
          classLevels: form.classLevels,
          adminName: form.adminName || undefined,
          adminEmail: form.adminEmail || undefined,
          adminPassword: form.adminPassword || undefined,
          adminPhone: form.adminPhone || undefined,
        });
        setCredentials(created.credentials);
        setModalOpen(false);
      }
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save school');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this school and all its data?')) return;
    try {
      await deleteSchool(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete school');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Schools</h2>
          <p className="text-sm text-muted">Create and manage schools / coaching centres on the platform.</p>
        </div>
        <Button onClick={openCreate}>+ Add school</Button>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="text-center text-muted" style={{ padding: 24 }}>Loading…</div>
        ) : schools.length === 0 ? (
          <EmptyState icon={<span style={{ fontSize: 40 }}>🏫</span>} title="No schools yet" description="Add your first school to get started." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Plan</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Classes</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Teachers</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Students</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school._id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px' }}>{school.name}</td>
                    <td style={{ padding: '10px 12px' }}>{school.type}</td>
                    <td style={{ padding: '10px 12px' }}>{school.code}</td>
                    <td style={{ padding: '10px 12px' }}>{school.plan}</td>
                    <td style={{ padding: '10px 12px' }}>{(school.classLevels ?? []).join(', ')}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{school.stats?.teachers ?? 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{school.stats?.students ?? 0}</td>
                    <td style={{ padding: '10px 12px' }}>{school.isActive ? 'Active' : 'Inactive'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(school)}>Edit</Button>{' '}
                      <Button size="sm" variant="danger" onClick={() => void onDelete(school._id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit school' : 'Add school'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="School name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {SCHOOL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="District">
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </Field>
            <Field label="Plan">
              <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </Field>
            <Field label="Max teachers">
              <Input type="number" value={form.maxTeachers} onChange={(e) => setForm({ ...form, maxTeachers: Number(e.target.value) })} />
            </Field>
            <Field label="Max students">
              <Input type="number" value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: Number(e.target.value) })} />
            </Field>
          </div>

          <Field label="Classes offered">
            <div className="flex flex-wrap gap-2">
              {CLASS_LEVELS.map((level) => (
                <label key={level} className="flex items-center gap-1" style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 10px' }}>
                  <input type="checkbox" checked={form.classLevels.includes(level)} onChange={() => toggleClass(level)} /> Class {level}
                </label>
              ))}
            </div>
          </Field>

          {!editing && (
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="School admin name">
                <Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
              </Field>
              <Field label="School admin email">
                <Input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              </Field>
              <Field label="School admin password">
                <Input type="text" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder="Optional (generated when empty)" />
              </Field>
              <Field label="School admin phone">
                <Input value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: e.target.value })} />
              </Field>
            </div>
          )}

          {formError && <div className="card form-error-card"><span className="text-sm text-danger">{formError}</span></div>}
          <div className="flex items-center gap-2">
            <Button onClick={() => void submit()} loading={saving}>{editing ? 'Save changes' : 'Create school'}</Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {credentials && (
        <Modal open onClose={() => setCredentials(null)} title="School created">
          <p className="text-sm">
            School <strong>{form.name}</strong> was created.
          </p>
          {credentials && (
            <div className="card card-pad" style={{ background: 'var(--bg-surface)', marginTop: 8 }}>
              <div className="text-sm"><strong>School admin login:</strong> {credentials.email}</div>
              <div className="text-sm"><strong>Temporary password:</strong> {credentials.password}</div>
              <p className="text-xs text-muted" style={{ marginTop: 8 }}>The admin should change the password after first login.</p>
            </div>
          )}
          <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
            <Button onClick={() => { setCredentials(null); openCreate(); }}>Create another</Button>
            <Button variant="ghost" onClick={() => setCredentials(null)}>Close</Button>
          </div>
        </Modal>
      )}

      <div className="text-sm text-muted">{total} school(s) total</div>
    </div>
  );
}
