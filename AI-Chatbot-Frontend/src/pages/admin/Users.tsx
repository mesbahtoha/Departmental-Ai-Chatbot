import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaUserCog } from 'react-icons/fa';
import { apiDelete, apiGet, apiPatch, getErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Form';
import { formatDateTime } from '@/lib/format';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const payload = await apiGet<{ items: AdminUserRow[]; total: number }>(
        `/api/v1/admin/users?${params.toString()}`
      );
      setUsers(payload.items);
      setTotal(payload.total);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (user: AdminUserRow) => {
    try {
      await apiPatch(`/api/v1/admin/users/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      void load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const promote = async (user: AdminUserRow) => {
    if (!window.confirm(`Grant admin role to ${user.email}?`)) return;
    try {
      await apiPatch(`/api/v1/admin/users/${user.id}`, { role: user.role === 'admin' ? 'user' : 'admin' });
      toast.success('Role updated');
      void load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const remove = async (user: AdminUserRow) => {
    if (!window.confirm(`Delete ${user.email} and all their chats?`)) return;
    try {
      await apiDelete(`/api/v1/admin/users/${user.id}`);
      toast.success('User deleted');
      void load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Users</h2>
          <span className="text-sm text-muted">{total} total users</span>
        </div>
        <div className="page-header-actions">
          <Input
            placeholder="Search name or email…"
            style={{ width: 260 }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : users.length === 0 ? (
          <EmptyState icon={<FaUserCog />} title="No users found" description="Try a different search." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                          <div>
                            <div className="font-semibold" style={{ fontSize: 13.5 }}>{user.name}</div>
                            <div className="text-xs text-muted">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge variant={user.role === 'admin' ? 'primary' : 'muted'}>{user.role}</Badge>
                      </td>
                      <td>
                        <Badge variant={user.isActive ? 'success' : 'danger'}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="text-sm text-secondary">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="text-sm text-secondary">{formatDateTime(user.createdAt)}</td>
                      <td>
                        <div className="flex justify-end" style={{ gap: 6 }}>
                          <Button size="sm" variant="ghost" onClick={() => void toggleActive(user)}>
                            {user.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void promote(user)}>
                            {user.role === 'admin' ? 'Demote' : 'Make admin'}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => void remove(user)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
              <Pagination page={page} total={total} limit={limit} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
