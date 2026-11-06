import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { listSchoolMembers, createSchoolMember, updateSchoolMember, deleteSchoolMember, resetSchoolMemberPassword } from '@/lib/api-v1';
import type { SchoolMember } from '@/types';
import { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function SchoolMembers() {
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', classLevel: 3 });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [schoolId] = useState<string | null>(user?.schoolId ?? null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await listSchoolMembers({ page: 1, limit: 100 });
      setMembers(payload.members ?? []);
      setTotal(payload.total ?? 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleActive = async (member: SchoolMember) => {
    if (!schoolId) return;
    try {
      await updateSchoolMember(member._id, { isActive: !member.isActive });
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const onResetPassword = async (member: SchoolMember) => {
    if (!schoolId) return;
    try {
      const credentials = await resetSchoolMemberPassword(member._id);
      toast.success(`Temporary password: ${credentials.password}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const onDelete = async (member: SchoolMember) => {
    if (!schoolId) return;
    if (!window.confirm(`Remove ${member.name} from the school?`)) return;
    try {
      await deleteSchoolMember(member._id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const submit = async () => {
    if (!schoolId) return;
    setSaving(true);
    setFormError('');
    try {
      await createSchoolMember({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        classLevel: Number(form.classLevel),
      });
      toast.success('Member added');
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'student', classLevel: 3 });
      await load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Members</h2>
          <span className="text-sm text-muted">{total} total members</span>
        </div>
        <div className="page-header-actions">
          <Button onClick={() => setCreateOpen(true)}>+ Add member</Button>
        </div>
      </div>

      {error && <div className="card form-error-card"><span className="text-sm text-danger">{error}</span></div>}

      <div className="card">
        {loading ? (
          <p className="text-muted" style={{ padding: 20 }}>Loading…</p>
        ) : members.length === 0 ? (
          <EmptyState icon={<span style={{ fontSize: 40 }}>👥</span>} title="No members yet" description="Add teachers and students to this school." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Class</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div className="font-semibold">{m.name}</div>
                      {m.designation && <div className="text-xs text-muted">{m.designation}</div>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{m.role}</td>
                    <td>{m.classLevel ? `Class ${m.classLevel}` : '—'}</td>
                    <td>{m.email}</td>
                    <td><Badge variant={m.isActive ? 'success' : 'muted'}>{m.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button size="sm" variant="ghost" onClick={() => void onToggleActive(m)}>Toggle</Button>{' '}
                      <Button size="sm" variant="ghost" onClick={() => void onResetPassword(m)}>Reset password</Button>{' '}
                      <Button size="sm" variant="ghost" onClick={() => void onDelete(m)}>Remove</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add school member">
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="field-label">Role</label>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div>
              <label className="field-label">Class level</label>
              <select className="select" value={String(form.classLevel)} onChange={(e) => setForm({ ...form, classLevel: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                  <option key={level} value={level}>Class {level}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && <div className="card form-error-card"><span className="text-sm text-danger">{formError}</span></div>}
          <div className="flex items-center gap-2">
            <Button onClick={() => void submit()} loading={saving}>Add member</Button>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
