import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaComments, FaEnvelopeOpenText, FaUsers } from 'react-icons/fa';
import { MdChat, MdStickyNote2, MdToken } from 'react-icons/md';
import { apiGet } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatTokens } from '@/lib/format';

interface DashboardData {
  users: { total: number; active: number };
  conversations: number;
  messages: number;
  messagesLast7Days: number;
  notices: number;
  usage: {
    today: { totalTokens: number; requests: number };
    month: { totalTokens: number; requests: number };
    totalRequests: number;
  };
  generatedAt: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiGet<{ stats: DashboardData }>('/api/v1/admin/dashboard')
      .then((payload) => setStats(payload.stats))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return <FullPageSpinner label="Loading dashboard…" />;

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Dashboard</h2>
      <p className="text-sm text-muted" style={{ marginTop: 0 }}>
        Overview of your AI chatbot deployment
      </p>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
        <StatCard label="Total users" value={stats.users.total} icon={<FaUsers />} hint={`${stats.users.active} active`} />
        <StatCard label="Conversations" value={stats.conversations} icon={<MdChat />} />
        <StatCard label="Messages (all time)" value={stats.messages} icon={<FaComments />} hint={`${stats.messagesLast7Days} in last 7 days`} />
        <StatCard label="Notices" value={stats.notices} icon={<MdStickyNote2 />} />
        <StatCard label="Tokens today" value={formatTokens(stats.usage.today.totalTokens)} icon={<MdToken />} accent="warning" hint={`${stats.usage.today.requests} requests`} />
        <StatCard label="Tokens this month" value={formatTokens(stats.usage.month.totalTokens)} icon={<MdToken />} accent="success" hint={`${stats.usage.totalRequests} total requests`} />
      </div>

      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="card-header">
          <span className="font-semibold">Quick actions</span>
        </div>
        <div className="card-body flex flex-col" style={{ gap: 10 }}>
          <Link to="/admin/notices" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
            <FaEnvelopeOpenText /> Manage notices &amp; documents
          </Link>
          <Link to="/admin/users" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
            <FaUsers /> Manage users
          </Link>
          <Link to="/admin/settings" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
            <MdToken /> Configure AI quotas &amp; settings
          </Link>
        </div>
      </div>
    </div>
  );
}
