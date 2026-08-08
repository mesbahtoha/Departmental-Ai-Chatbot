import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechState = 'idle' | 'recording';

function createRecognizer(): SpeechRecognition | null {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognizer = new Ctor();
  recognizer.lang = 'en-US';
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;
  return recognizer;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Browser speech-to-text. Converts the user's voice into editable text in the
 * input field. Falls back gracefully (supported flag) where the API is missing.
 */
export function useSpeechToText() {
  const [state, setState] = useState<SpeechState>('idle');
  const [supported] = useState(isSpeechRecognitionSupported);
  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef<(text: string) => void>(() => {});
  const onInterimRef = useRef<(text: string) => void>(() => {});
  const onErrorRef = useRef<(message: string) => void>(() => {});
  const finalTextRef = useRef('');

  const stop = useCallback(() => {
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    finalTextRef.current = '';
    if (recognizer) {
      recognizer.onend = null;
      recognizer.onresult = null;
      recognizer.onerror = null;
      try {
        recognizer.abort();
      } catch {
        // ignore
      }
    }
    setState('idle');
  }, []);

  const start = useCallback(
    (handlers: {
      onFinal: (text: string) => void;
      onInterim?: (text: string) => void;
      onError?: (message: string) => void;
    }) => {
      if (state === 'recording') return;
      if (!supported) {
        handlers.onError?.('Speech recognition is not supported in this browser.');
        return;
      }

      const recognizer = createRecognizer();
      if (!recognizer) {
        handlers.onError?.('Speech recognition is not supported in this browser.');
        return;
      }

      onFinalRef.current = handlers.onFinal;
      onInterimRef.current = handlers.onInterim ?? (() => {});
      onErrorRef.current = handlers.onError ?? (() => {});
      finalTextRef.current = '';
      recognizerRef.current = recognizer;

      recognizer.onstart = () => setState('recording');
      recognizer.onend = () => {
        if (recognizerRef.current === recognizer) setState('idle');
      };
      recognizer.onerror = (event) => {
        if (event.error === 'not-allowed') {
          onErrorRef.current('Microphone permission was denied. Please allow microphone access and try again.');
        } else if (event.error === 'no-speech') {
          onErrorRef.current('No speech detected. Please try again.');
        } else if (event.error !== 'aborted') {
          onErrorRef.current('Speech recognition error. Please try again.');
        }
      };
      recognizer.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalTextRef.current += transcript;
          } else {
            interim += transcript;
          }
        }
        const finalText = finalTextRef.current;
        const combined = `${finalText}${interim}`.trim();
        if (combined) {
          if (interim) {
            onInterimRef.current(combined);
          } else {
            onFinalRef.current(finalText);
          }
        }
      };

      try {
        recognizer.start();
      } catch {
        // already started - ignore
      }
    },
    [state, supported]
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const recognizer = recognizerRef.current;
      recognizerRef.current = null;
      if (recognizer) {
        try {
          recognizer.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { state, start, stop, supported };
}
