import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaComments, FaListAlt, FaClipboardList } from 'react-icons/fa';
import { getSchoolWorkspace } from '@/lib/api-v1';
import { useAuthStore } from '@/store/auth.store';
import { StatCard } from '@/components/ui/StatCard';

export function SchoolDashboard() {
  const user = useAuthStore((s) => s.user);
  const [workspace, setWorkspace] = useState<{
    school: { name: string; code: string; type: string };
    stats: { teachers: number; students: number; questions: number; assessments: number; pendingGrading: number };
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const schoolId = user?.schoolId;
    if (!schoolId) {
      setError('No school context. Ask a Super Admin for a school join code.');
      return;
    }
    let cancelled = false;
    getSchoolWorkspace()
      .then((data) => {
        if (!cancelled) setWorkspace(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load workspace');
      });
    return () => {
      cancelled = true;
    };
  }, [user?.schoolId]);

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-title">
            <h2>School Dashboard</h2>
          </div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-title">
            <h2>School Dashboard</h2>
          </div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  const { school, stats } = workspace;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>{school.name}</h2>
          <span className="text-sm text-muted">Code: {school.code} • {school.type}</span>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
        <StatCard label="Teachers" value={stats.teachers} icon={<FaUsers />} />
        <StatCard label="Students" value={stats.students} icon={<FaUsers />} />
        <StatCard label="Questions" value={stats.questions} icon={<FaListAlt />} />
        <StatCard label="Assessments" value={stats.assessments} icon={<FaClipboardList />} />
        <StatCard label="Pending grading" value={stats.pendingGrading} icon={<FaComments />} accent="warning" />
      </div>

      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="card-header">
          <span className="font-semibold">Quick actions</span>
        </div>
        <div className="card-body flex flex-col" style={{ gap: 10 }}>
          <Link to="/school/members" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
            <FaUsers /> Manage teachers &amp; students
          </Link>
          <Link to="/school/questions" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
            <FaListAlt /> Manage question bank
          </Link>
          <Link to="/school/assessments" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
            <FaClipboardList /> Review assessments
          </Link>
        </div>
      </div>
    </div>
  );
}
