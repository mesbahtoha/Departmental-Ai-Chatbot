import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { memo, useDeferredValue } from 'react';
import { CodeBlock } from './CodeBlock';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, streaming }: MarkdownRendererProps) {
  // During SSE streaming the content grows on every token; deferring the
  // markdown parse keeps the main thread responsive (typing feels smooth).
  const rendered = useDeferredValue(content);

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const text = String(children).replace(/\n$/, '');
            const isBlock = Boolean(className) || text.includes('\n');
            if (isBlock) {
              return <CodeBlock language={match?.[1] ?? ''} code={text} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            );
          },
        }}
      >
        {rendered}
      </ReactMarkdown>
      {streaming && <span className="typing-cursor" />}
    </div>
  );
});
