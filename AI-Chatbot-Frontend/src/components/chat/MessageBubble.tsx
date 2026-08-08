import { useState } from 'react';
import toast from 'react-hot-toast';
import { FaRegThumbsUp, FaRegThumbsDown, FaUser } from 'react-icons/fa';
import { MdAutoAwesome, MdThumbUp, MdThumbDown } from 'react-icons/md';
import type { ChatMessage } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Citations } from './Citations';
import { apiPost } from '@/lib/api';
import { formatTokens } from '@/lib/format';
import { Button } from '@/components/ui/Button';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  const isUser = message.role === 'user';

  const sendFeedback = async (type: 'like' | 'dislike') => {
    if (feedback === type) return;
    setFeedback(type);
    if (type === 'dislike') {
      setShowComment(true);
      return;
    }
    try {
      await apiPost(`/api/v1/conversations/${message.conversation}/messages/${message._id}/feedback`, {
        type,
      });
      toast.success('Thanks for your feedback!');
    } catch {
      toast.error('Could not save feedback.');
    }
  };

  const submitComment = async () => {
    try {
      await apiPost(`/api/v1/conversations/${message.conversation}/messages/${message._id}/feedback`, {
        type: 'dislike',
        comment: comment.trim() || undefined,
      });
      toast.success('Thanks for your feedback!');
      setShowComment(false);
    } catch {
      toast.error('Could not save feedback.');
    }
  };

  const streaming = message.status === 'streaming' || message.status === 'pending';
  const showActions = !isUser && !streaming && message.status === 'complete';

  return (
    <div className="flex message-row">
      <div
        className="avatar"
        style={{
          width: 32,
          height: 32,
          fontSize: 14,
          background: isUser ? 'var(--text-muted)' : 'var(--color-primary)',
          flexShrink: 0,
        }}
      >
        {isUser ? <FaUser size={14} /> : <MdAutoAwesome size={15} />}
      </div>

      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="text-sm font-semibold mb-1">
          {isUser ? 'You' : 'Assistant'}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment) => (
              <span className="message-attachment-chip" key={attachment.id} title={attachment.name}>
                <span className="message-attachment-chip-icon">
                  {attachment.type === 'image' ? '🖼️' : '📄'}
                </span>
                <span className="message-attachment-chip-name">{attachment.name}</span>
              </span>
            ))}
          </div>
        )}

        <MarkdownRenderer content={message.content} streaming={streaming} />

        {message.status === 'error' && (
          <div className="text-sm text-danger mt-2 font-medium">Generation failed.</div>
        )}

        <Citations citations={message.citations} sources={message.sources} />

        {!isUser && (message.totalTokens ?? 0) > 0 && (
          <div className="text-xs text-muted mt-2">
            {formatTokens(message.totalTokens)} tokens
            {message.promptTokens !== undefined && message.completionTokens !== undefined
              ? ` · ${formatTokens(message.promptTokens)} in / ${formatTokens(message.completionTokens)} out`
              : ''}
          </div>
        )}

        {showActions && (
          <div className="flex items-center" style={{ gap: 6, marginTop: 10 }}>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 6, fontSize: 15 }}
              title="Like"
              onClick={() => void sendFeedback('like')}
            >
              {feedback === 'like' ? <MdThumbUp style={{ color: 'var(--color-success)' }} /> : <FaRegThumbsUp />}
            </button>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 6, fontSize: 15 }}
              title="Dislike"
              onClick={() => void sendFeedback('dislike')}
            >
              {feedback === 'dislike' ? <MdThumbDown style={{ color: 'var(--color-danger)' }} /> : <FaRegThumbsDown />}
            </button>
            {showComment && (
              <div className="flex items-center" style={{ gap: 8, marginLeft: 8, flexWrap: 'wrap' }}>
                <input
                  className="input feedback-input"
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  placeholder="Tell us what went wrong…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button size="sm" variant="secondary" onClick={() => void submitComment()}>
                  Submit
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
