import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage, streamPost } from '@/lib/api';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { getLanguagePreference, getModePreference } from '@/components/chat/ChatComposer';
import type { AIMode, ChatAttachment, ChatMessage, Citation, Source } from '@/types';

let tempCounter = 0;
function tempId(prefix = 'tmp'): string {
  tempCounter += 1;
  return `${prefix}-${Date.now()}-${tempCounter}`;
}

function makeLocalMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    _id: tempId(role === 'user' ? 'user' : 'asst'),
    conversation: conversationId,
    user: '',
    role,
    content,
    status: 'complete',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

export function useChatSession(conversationId: string) {
  const abortRef = useRef<AbortController | null>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const handleStream = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      placeholder: { userMessage?: ChatMessage; assistantMessage: ChatMessage; targetId?: string }
    ) => {
      const chat = useChatStore.getState();
      if (chat.isStreaming) {
        toast.error('Please wait for the current response to finish.');
        return;
      }

      const { userMessage, assistantMessage, targetId } = placeholder;

      if (userMessage) chat.appendLocalMessage(userMessage);
      if (!targetId) chat.appendLocalMessage(assistantMessage);
      chat.setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let activeId = targetId ?? assistantMessage._id;
      if (targetId) {
        chat.updateLocalMessage(targetId, {
          content: '',
          status: 'streaming',
          citations: [],
          sources: [],
        });
      }

      const finalize = (patch: Partial<ChatMessage>) => {
        chat.updateLocalMessage(activeId, patch);
        chat.setStreaming(false);
        abortRef.current = null;
        void chat.loadConversations();
        void useAuthStore.getState().refreshUsage();
      };

      try {
        await streamPost(url, body, (event) => {
          const state = useChatStore.getState();
          switch (event.type) {
            case 'start': {
              const serverId = String(event.messageId || '');
              const prevId = activeId;
              activeId = serverId || activeId;
              if (serverId && prevId !== serverId) {
                const existing = state.current?.messages.find((m) => m._id === prevId);
                if (existing) {
                  state.updateLocalMessage(prevId, { _id: serverId } as Partial<ChatMessage>);
                  activeId = serverId;
                }
              }
              state.updateLocalMessage(activeId, { status: 'streaming' });
              break;
            }
            case 'token':
              state.updateLocalMessage(activeId, {
                content: (state.current?.messages.find((m) => m._id === activeId)?.content ?? '') + String(event.content ?? ''),
              });
              break;
            case 'citations':
              state.updateLocalMessage(activeId, {
                citations: (event.citations as Citation[]) || [],
                sources: (event.sources as Source[]) || [],
              });
              break;
            case 'usage':
              state.updateLocalMessage(activeId, {
                promptTokens: Number(event.promptTokens ?? 0),
                completionTokens: Number(event.completionTokens ?? 0),
                totalTokens: Number(event.totalTokens ?? 0),
              });
              break;
            case 'done':
              state.updateLocalMessage(activeId, {
                status: 'complete',
                model: String(event.model || '') || undefined,
              });
              break;
            case 'error':
              state.updateLocalMessage(activeId, { status: 'error' });
              toast.error(String(event.message || 'Something went wrong during generation.'));
              break;
          }
        }, controller.signal);

        finalize({
          status: 'complete',
          model: useChatStore.getState().current?.messages.find((m) => m._id === activeId)?.model,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          finalize({ status: 'stopped' });
          toast('Generation stopped.', { icon: '⏹️' });
          return;
        }
        finalize({
          status: 'error',
          content: `⚠️ ${getErrorMessage(error)}`,
        });
        toast.error(getErrorMessage(error));
      }
    },
    []
  );

  const sendMessage = useCallback(
    (content: string, options?: { language?: string; mode?: AIMode; attachments?: ChatAttachment[] }) => {
      const userMessage = makeLocalMessage(conversationId, 'user', content, {
        attachments: options?.attachments ?? [],
      });
      const assistantMessage = makeLocalMessage(conversationId, 'assistant', '', {
        status: 'pending',
      });
      void handleStream(
        `/api/v1/conversations/${conversationId}/messages`,
        {
          content,
          language: options?.language || getLanguagePreference(),
          ...(options?.mode ? { mode: options.mode } : {}),
          ...(options?.attachments?.length
            ? {
                attachments: options.attachments.map((attachment) => ({
                  id: attachment.id,
                  type: attachment.type,
                  name: attachment.name,
                })),
              }
            : {}),
        },
        { userMessage, assistantMessage }
      );
    },
    [conversationId, handleStream]
  );

  const regenerate = useCallback(
    (messageId: string) => {
      const state = useChatStore.getState();
      const existing = state.current?.messages.find((m) => m._id === messageId);
      if (!existing || existing.role !== 'assistant') return;
      void handleStream(
        `/api/v1/conversations/${conversationId}/regenerate`,
        { messageId, language: getLanguagePreference(), mode: getModePreference() },
        { assistantMessage: existing, targetId: existing._id }
      );
    },
    [conversationId, handleStream]
  );

  const continueChat = useCallback(() => {
    const assistantMessage = makeLocalMessage(conversationId, 'assistant', '', { status: 'pending' });
    void handleStream(
      `/api/v1/conversations/${conversationId}/continue`,
      { language: getLanguagePreference(), mode: getModePreference() },
      { assistantMessage }
    );
  }, [conversationId, handleStream]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, regenerate, continueChat, stop, isStreaming };
}
