import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaRobot } from 'react-icons/fa';
import type { SharedChat } from '@/types';
import { apiGet } from '@/lib/api';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/format';

export function ShareView() {
  const { token } = useParams<{ token: string }>();
  const [chat, setChat] = useState<SharedChat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiGet<{ chat: SharedChat }>(`/api/v1/conversations/share/${token}`)
      .then((payload) => setChat(payload.chat))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Shared chat not found'));
  }, [token]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', padding: 24, gap: 12 }}>
        <div style={{ fontSize: 42 }}>🔒</div>
        <h2>Shared chat not found</h2>
        <p className="text-muted text-sm">This link may be invalid or the chat is no longer shared.</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
      </div>
    );
  }

  if (!chat) return <FullPageSpinner label="Loading shared chat…" />;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px' }}>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center gap-3"
          style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface-2)' }}
        >
          <div
            className="flex items-center justify-center"
            style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontSize: 20 }}
          >
            <FaRobot />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, margin: 0 }}>{chat.title || 'Shared conversation'}</h1>
            <div className="text-xs text-muted">
              Shared by {chat.ownerName} · {formatDateTime(chat.createdAt)}
            </div>
          </div>
        </div>
        <div style={{ padding: '8px 22px' }}>
          {chat.messages.map((message, index) => (
            <div key={index} style={{ padding: '14px 0', borderBottom: index < chat.messages.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div className="text-xs font-bold mb-1" style={{ color: message.role === 'user' ? 'var(--text-muted)' : 'var(--color-primary)' }}>
                {message.role === 'user' ? 'YOU' : 'ASSISTANT'}
              </div>
              <MarkdownRenderer content={message.content} />
            </div>
          ))}
        </div>
      </div>
      <div className="text-center mt-4">
        <Link to="/register" className="text-sm text-muted">
          Want your own AI assistant? Create a free account →
        </Link>
      </div>
    </div>
  );
}
