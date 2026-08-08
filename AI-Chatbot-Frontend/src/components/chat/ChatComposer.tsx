import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MdSend,
  MdStop,
  MdAttachFile,
  MdClose,
  MdMic,
  MdMicOff,
  MdRecordVoiceOver,
} from 'react-icons/md';
import { apiUpload, getErrorMessage } from '@/lib/api';
import { compressImage, formatBytes } from '@/lib/image';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useVoiceMode } from '@/hooks/useVoiceMode';
import type { AIMode, ChatAttachment } from '@/types';

export type LanguagePreference = 'auto' | 'en' | 'bn' | 'banglish';

const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'auto', label: '🌐 Auto' },
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
  { value: 'banglish', label: 'Banglish' },
];

const MODE_OPTIONS: { value: AIMode; label: string }[] = [
  { value: 'fast', label: '⚡ Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'accurate', label: '🎯 Accurate' },
];

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const COMPRESS_IMAGE_OVER = 1.5 * 1024 * 1024;

export function getLanguagePreference(): LanguagePreference {
  const stored = localStorage.getItem('nf_lang');
  return stored === 'en' || stored === 'bn' || stored === 'banglish' ? stored : 'auto';
}

export function getModePreference(): AIMode {
  const stored = localStorage.getItem('nf_mode');
  return stored === 'fast' || stored === 'accurate' ? stored : 'balanced';
}

interface AttachmentDraft {
  localId: string;
  file: File;
  type: 'image' | 'pdf';
  name: string;
  size: number;
  previewUrl?: string;
}

export interface ComposerSendPayload {
  content: string;
  language: LanguagePreference;
  mode: AIMode;
  attachments: ChatAttachment[];
}

let draftCounter = 0;
function draftId(): string {
  draftCounter += 1;
  return `draft-${Date.now()}-${draftCounter}`;
}

export function ChatComposer({
  onSend,
  isStreaming,
  onStop,
  disabled,
}: {
  onSend: (payload: ComposerSendPayload) => void;
  isStreaming: boolean;
  onStop: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [language, setLanguage] = useState<LanguagePreference>(getLanguagePreference);
  const [mode, setMode] = useState<AIMode>(getModePreference);
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftsRef = useRef<AttachmentDraft[]>([]);
  draftsRef.current = drafts;

  const mic = useSpeechToText();
  const voice = useVoiceMode({ onSend: (text) => performSend(text, []) });

  useEffect(() => {
    return () => {
      for (const draft of draftsRef.current) {
        if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      }
    };
  }, []);

  const addDraft = (file: File) => {
    if (drafts.length >= MAX_FILES) {
      toast.error(`You can attach up to ${MAX_FILES} files in a single message.`);
      return;
    }
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME.has(file.type)) {
      toast.error('Only images (.jpg, .jpeg, .png, .webp) and PDF (.pdf) files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Please upload a file smaller than 10 MB.');
      return;
    }

    const add = (processed: File) => {
      const isImage = processed.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(processed) : undefined;
      setDrafts((current) => [
        ...current,
        {
          localId: draftId(),
          file: processed,
          type: isImage ? 'image' : 'pdf',
          name: processed.name,
          size: processed.size,
          previewUrl,
        },
      ]);
    };

    // Compress large images client-side so uploads stay fast.
    if (file.type.startsWith('image/') && file.size > COMPRESS_IMAGE_OVER) {
      compressImage(file)
        .then(add)
        .catch(() => add(file));
    } else {
      add(file);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (drafts.length + list.length > MAX_FILES) {
      toast.error(`You can attach up to ${MAX_FILES} files in a single message.`);
      return;
    }
    for (const file of list) addDraft(file);
  };

  const removeDraft = (localId: string) => {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.localId !== localId);
      const removed = current.find((draft) => draft.localId === localId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const clearDrafts = () => {
    for (const draft of draftsRef.current) {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    }
    setDrafts([]);
  };

  const stopMic = () => {
    if (mic.state === 'recording') mic.stop();
  };

  const performSend = async (content: string, attachmentDrafts: AttachmentDraft[]) => {
    if (isStreaming || disabled || uploading) return;
    const trimmed = content.trim();
    if (!trimmed && attachmentDrafts.length === 0) return;

    let uploaded: ChatAttachment[] = [];
    if (attachmentDrafts.length > 0) {
      setUploading(true);
      try {
        const formData = new FormData();
        for (const draft of attachmentDrafts) formData.append('files', draft.file);
        const payload = await apiUpload<{ attachments: ChatAttachment[] }>(
          '/api/v1/attachments',
          formData
        );
        uploaded = payload.attachments ?? [];
        if (!uploaded.length) throw new Error('Could not upload attachments. Please try again.');
      } catch (error) {
        toast.error(getErrorMessage(error));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    stopMic();
    onSend({
      content: trimmed || 'Analyze the attached file(s).',
      language,
      mode,
      attachments: uploaded,
    });
    setValue('');
    clearDrafts();
  };

  const submit = () => {
    void performSend(value, drafts);
  };

  const toggleMic = () => {
    if (voice.active) return;
    if (mic.state === 'recording') {
      mic.stop();
      return;
    }
    const before = value;
    mic.start({
      onInterim: (text) => setValue(`${before}${before ? ' ' : ''}${text}`),
      onFinal: (text) => setValue(`${before}${before ? ' ' : ''}${text}`),
      onError: (message) => toast.error(message),
    });
  };

  const changeMode = (next: string) => {
    const selected = (MODE_OPTIONS.some((o) => o.value === next) ? next : 'balanced') as AIMode;
    setMode(selected);
    localStorage.setItem('nf_mode', selected);
  };

  const changeLanguage = (next: string) => {
    const selected = (LANGUAGE_OPTIONS.some((o) => o.value === next) ? next : 'auto') as LanguagePreference;
    setLanguage(selected);
    localStorage.setItem('nf_lang', selected);
  };

  const canSend = Boolean(value.trim()) || drafts.length > 0;
  const voiceActive = voice.active;

  return (
    <div className="chat-composer">
      <div
        className="chat-composer-inner"
        style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}
      >
        {drafts.length > 0 && (
          <div className="composer-attachments">
            {drafts.map((draft) => (
              <div className="composer-attachment" key={draft.localId}>
                {draft.type === 'image' && draft.previewUrl ? (
                  <img src={draft.previewUrl} alt={draft.name} className="composer-attachment-thumb" />
                ) : (
                  <span className="composer-attachment-icon">📄</span>
                )}
                <span className="composer-attachment-info">
                  <span className="composer-attachment-name">{draft.name}</span>
                  <span className="composer-attachment-size">{formatBytes(draft.size)}</span>
                </span>
                <button
                  className="composer-attachment-remove"
                  onClick={() => removeDraft(draft.localId)}
                  title="Remove attachment"
                  aria-label="Remove attachment"
                >
                  <MdClose size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`composer-box${voiceActive ? ' composer-box-voice' : ''}`}
          style={{
            border: '1px solid var(--border-strong)',
            borderRadius: 18,
            background: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <textarea
            className="composer-textarea"
            rows={1}
            value={value}
            placeholder={disabled ? 'Your quota is exhausted…' : 'Ask anything…'}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />

          <div className="composer-controls">
            <div className="composer-controls-left">
              <button
                className="composer-icon-btn"
                title="Attach image or PDF (temporary, not stored)"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading || voiceActive}
              >
                <MdAttachFile size={18} />
              </button>

              <select
                className="select composer-select composer-mode-select"
                value={mode}
                onChange={(e) => changeMode(e.target.value)}
                disabled={isStreaming || disabled}
                title="AI model mode"
                aria-label="AI model mode"
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="select composer-select"
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                disabled={isStreaming || disabled}
                title="Reply language"
                aria-label="Reply language"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="composer-controls-right">
              <button
                className={`composer-icon-btn${mic.state === 'recording' ? ' composer-recording' : ''}`}
                title={mic.supported ? (mic.state === 'recording' ? 'Stop voice input' : 'Voice input') : 'Voice input not supported'}
                onClick={toggleMic}
                disabled={disabled || !mic.supported || voiceActive}
              >
                {mic.state === 'recording' ? <MdMicOff size={18} /> : <MdMic size={18} />}
              </button>

              <button
                className={`composer-icon-btn composer-voice-btn${voiceActive ? ` composer-voice-active composer-voice-${voice.mode}` : ''}`}
                title={voiceActive ? 'End voice conversation' : 'Voice conversation'}
                onClick={() => (voiceActive ? voice.stop() : voice.start())}
                disabled={disabled || mic.state === 'recording'}
              >
                {voiceActive ? (
                  <>
                    <span className="composer-voice-dot" />
                    <MdRecordVoiceOver size={18} />
                  </>
                ) : (
                  <MdRecordVoiceOver size={18} />
                )}
              </button>

              {isStreaming ? (
                <button className="composer-send-btn" onClick={onStop} title="Stop generating">
                  <MdStop size={19} />
                </button>
              ) : (
                <button
                  className={`composer-send-btn${canSend ? ' composer-send-ready' : ''}`}
                  onClick={submit}
                  disabled={!canSend || disabled || uploading || voiceActive}
                  title="Send"
                >
                  {uploading ? <span className="spin" style={{ width: 15, height: 15, display: 'inline-block', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} /> : <MdSend size={18} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="composer-privacy">
            Your uploaded files are used only for this conversation and are not permanently stored.
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
