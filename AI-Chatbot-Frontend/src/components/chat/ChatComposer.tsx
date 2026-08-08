import { useState } from 'react';
import { MdSend, MdStop } from 'react-icons/md';

export type LanguagePreference = 'auto' | 'en' | 'bn' | 'banglish';

const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'auto', label: '🌐 Auto' },
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
  { value: 'banglish', label: 'Banglish' },
];

export function getLanguagePreference(): LanguagePreference {
  const stored = localStorage.getItem('nf_lang');
  return stored === 'en' || stored === 'bn' || stored === 'banglish' ? stored : 'auto';
}

export function ChatComposer({
  onSend,
  isStreaming,
  onStop,
  disabled,
}: {
  onSend: (content: string, language: LanguagePreference) => void;
  isStreaming: boolean;
  onStop: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [language, setLanguage] = useState<LanguagePreference>(getLanguagePreference);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed, language);
    setValue('');
  };

  const changeLanguage = (next: string) => {
    const selected = (LANGUAGE_OPTIONS.some((o) => o.value === next) ? next : 'auto') as LanguagePreference;
    setLanguage(selected);
    localStorage.setItem('nf_lang', selected);
  };

  return (
    <div
      className="chat-composer"
      style={{
        maxWidth: 860,
        margin: '0 auto',
        width: '100%',
        flexShrink: 0,
      }}
    >
      <div
        className="flex items-end"
        style={{
          gap: 8,
          border: '1px solid var(--border-strong)',
          borderRadius: 18,
          padding: '8px 10px',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'border-color 0.15s ease',
        }}
      >
        <textarea
          className="flex-1"
          rows={1}
          value={value}
          placeholder={disabled ? 'Your quota is exhausted…' : 'Ask about notices, routines, exams…'}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          style={{
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: 14.5,
            lineHeight: 1.5,
            maxHeight: 160,
            minHeight: 26,
          }}
        />
        <select
          className="select"
          value={language}
          onChange={(e) => changeLanguage(e.target.value)}
          disabled={isStreaming || disabled}
          title="Reply language"
          style={{ width: 'auto', flexShrink: 0, padding: '6px 10px', fontSize: 13 }}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isStreaming ? (
          <button
            className="btn"
            style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, flexShrink: 0 }}
            onClick={onStop}
            title="Stop generating"
          >
            <MdStop size={19} />
          </button>
        ) : (
          <button
            className="btn"
            style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, flexShrink: 0 }}
            onClick={submit}
            disabled={!value.trim() || disabled}
            title="Send"
          >
            <MdSend size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
