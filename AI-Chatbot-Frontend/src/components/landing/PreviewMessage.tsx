import { useState, type ReactNode } from 'react';
import { FaCheck, FaCopy, FaRobot, FaUser } from 'react-icons/fa';

interface PreviewMessageProps {
  role: 'user' | 'ai';
  name: string;
  time: string;
  plainText: string;
  children: ReactNode;
  delay?: number;
}

export function PreviewMessage({ role, name, time, plainText, children, delay = 0 }: PreviewMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={`preview-msg ${isUser ? 'preview-msg-user' : 'preview-msg-ai'} fade-in-up`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="preview-avatar" aria-hidden="true">
        {isUser ? <FaUser /> : <FaRobot />}
      </div>
      <div className="preview-msg-body">
        <div className="preview-msg-head">
          <span className="preview-name">{name}</span>
          <span className="preview-time">{time}</span>
        </div>
        <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
          <div className="preview-md">{children}</div>
          {!isUser && (
            <button
              type="button"
              className="copy-btn"
              onClick={() => void copy()}
              aria-label={copied ? 'Copied' : 'Copy message'}
              title="Copy message"
            >
              {copied ? <FaCheck style={{ color: 'var(--color-success)' }} /> : <FaCopy />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
