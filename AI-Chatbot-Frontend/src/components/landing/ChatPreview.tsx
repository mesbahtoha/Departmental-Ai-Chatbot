import { FaRobot } from 'react-icons/fa';
import { PreviewMessage } from './PreviewMessage';
import { SourceCard } from './SourceCard';

export function ChatPreview() {
  return (
    <section className="chat-preview-section" aria-label="Chat preview">
      <div className="chat-preview-shell">
        <div className="chat-window float-slow">
          <div className="chat-window-bar">
            <div className="window-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="chat-window-title">
              <FaRobot style={{ color: 'var(--color-primary)' }} /> NoticeFlow AI
            </span>
            <span className="badge badge-success">● Online</span>
          </div>
          <div className="chat-window-body">
            <PreviewMessage
              role="user"
              name="You"
              time="10:02 AM"
              plainText="When is the Physics final exam?"
              delay={0.15}
            >
              When is the <strong>Physics</strong> final exam?
            </PreviewMessage>
            <PreviewMessage
              role="ai"
              name="NoticeFlow AI"
              time="10:02 AM"
              plainText="The Physics final exam is scheduled for April 25, 2026. Here is the official source from the uploaded routine."
              delay={0.3}
            >
              <p>
                The <strong>Physics</strong> final exam is scheduled for <strong>April 25, 2026</strong>.
                Here is the official source from the uploaded routine:
              </p>
              <SourceCard fileName="Final Exam Routine.pdf" uploaded="2 days ago" />
            </PreviewMessage>
            <PreviewMessage
              role="user"
              name="You"
              time="10:03 AM"
              plainText="Can you show the exam routine?"
              delay={0.45}
            >
              Can you show the <strong>exam routine</strong>?
            </PreviewMessage>
            <PreviewMessage
              role="ai"
              name="NoticeFlow AI"
              time="10:03 AM"
              plainText="Sure! Here is the latest uploaded routine: L2T2 - Final Exam Routine.pdf, covering Sunday through Thursday."
              delay={0.6}
            >
              <p>
                Sure! Here is the latest uploaded routine: <code>L2T2 — Final Exam Routine.pdf</code>,
                covering <strong>Sunday – Thursday</strong> with the full schedule and room numbers.
              </p>
            </PreviewMessage>
          </div>
          <div className="chat-window-footer">
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="text-xs text-muted">Ask anything about your notices…</span>
          </div>
        </div>
      </div>
    </section>
  );
}
