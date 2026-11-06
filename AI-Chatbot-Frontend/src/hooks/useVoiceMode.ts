import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useChatStore } from '@/store/chat.store';
import { isSpeechRecognitionSupported, useSpeechToText } from './useSpeechToText';

export type VoiceModeState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Optional external reply source (used by the tutor page, which has no chat store). */
export interface VoiceModeExternal {
  /** True while the request that will produce the reply is running. */
  busy: boolean;
  /** Latest assistant reply to read aloud, or null when there is none yet. */
  reply: { id: string; text: string } | null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isVoiceModeSupported(): boolean {
  return isSpeechRecognitionSupported() && isSpeechSynthesisSupported();
}

/**
 * AI voice conversation mode:
 * listen (mic) -> send -> wait for AI -> read the reply aloud -> listen again.
 * Uses browser speech recognition + speech synthesis; no extra backend.
 */
export function useVoiceMode({
  onSend,
  external,
}: {
  onSend: (text: string) => void;
  external?: VoiceModeExternal;
}) {
  const { start: startStt, stop: stopStt } = useSpeechToText();
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<VoiceModeState>('idle');
  const [supported] = useState(isVoiceModeSupported);

  const storeIsStreaming = useChatStore((s) => s.isStreaming);
  const externalRef = useRef(external);
  externalRef.current = external;

  const isStreaming = external ? external.busy : storeIsStreaming;

  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  const loopRef = useRef(false);
  const lastSpokenIdRef = useRef<string | null>(null);
  const wasStreamingRef = useRef(false);
  const beginListeningRef = useRef<() => void>(() => {});

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text: string, onEnd: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.04;
    utterance.pitch = 1;
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
    window.speechSynthesis.speak(utterance);
  }, []);

  const beginListening = useCallback(() => {
    if (!loopRef.current) return;
    setMode('listening');
    startStt({
      onFinal: (text) => {
        if (!loopRef.current) return;
        stopStt();
        onSendRef.current(text.trim() || 'Hello');
        setMode('thinking');
      },
      onError: (message) => {
        if (!loopRef.current) return;
        loopRef.current = false;
        setActive(false);
        setMode('idle');
        stopSpeaking();
        toast.error(message);
      },
    });
  }, [startStt, stopStt, stopSpeaking]);

  beginListeningRef.current = beginListening;

  const start = useCallback(() => {
    if (!supported) {
      toast.error('Voice mode is not supported in this browser.');
      return;
    }
    const busy = externalRef.current ? externalRef.current.busy : useChatStore.getState().isStreaming;
    if (busy) {
      toast.error('Please wait for the current response to finish.');
      return;
    }
    loopRef.current = true;
    // Never re-read a reply that was already spoken before this session.
    lastSpokenIdRef.current = externalRef.current?.reply?.id ?? null;
    wasStreamingRef.current = false;
    setActive(true);
    beginListening();
  }, [supported, beginListening]);

  const stop = useCallback(() => {
    loopRef.current = false;
    stopStt();
    stopSpeaking();
    setActive(false);
    setMode('idle');
  }, [stopStt, stopSpeaking]);

  // While thinking, wait for the stream to finish, then read the answer.
  useEffect(() => {
    if (!active || mode !== 'thinking') {
      wasStreamingRef.current = isStreaming;
      return;
    }

    if (wasStreamingRef.current && !isStreaming) {
      const ext = externalRef.current;
      let reply: { id: string; text: string } | null = null;

      if (ext) {
        reply = ext.reply;
      } else {
        const messages = useChatStore.getState().current?.messages ?? [];
        const last = messages[messages.length - 1];
        if (last && last.role === 'assistant' && last.status === 'complete' && last.content.trim()) {
          reply = { id: last._id, text: last.content };
        }
      }

      if (reply && reply.text.trim() && reply.id !== lastSpokenIdRef.current) {
        lastSpokenIdRef.current = reply.id;
        setMode('speaking');
        speak(reply.text, () => {
          if (loopRef.current) {
            beginListeningRef.current();
          }
        });
      } else if (loopRef.current) {
        // Stopped / errored response: simply listen again.
        beginListeningRef.current();
      }
    }

    wasStreamingRef.current = isStreaming;
  }, [active, mode, isStreaming, speak]);

  // Full stop when unmounted.
  useEffect(() => {
    return () => {
      loopRef.current = false;
      stopStt();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { active, mode, start, stop, supported };
}
