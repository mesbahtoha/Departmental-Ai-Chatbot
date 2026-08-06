import { create } from 'zustand';
import type { ChatMessage, Conversation, ConversationDetail } from '@/types';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

interface ChatState {
  conversations: Conversation[];
  conversationsLoaded: boolean;
  current: { conversation: Conversation; messages: ChatMessage[] } | null;
  isStreaming: boolean;
  loadConversations: (search?: string) => Promise<void>;
  loadConversation: (id: string) => Promise<ConversationDetail>;
  createConversation: (title?: string) => Promise<Conversation>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePinned: (id: string, pinned: boolean) => Promise<void>;
  archiveConversation: (id: string, isArchived: boolean) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  appendLocalMessage: (message: ChatMessage) => void;
  updateLocalMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setStreaming: (streaming: boolean) => void;
  setCurrent: (current: { conversation: Conversation; messages: ChatMessage[] } | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  conversationsLoaded: false,
  current: null,
  isStreaming: false,

  async loadConversations(search) {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('search', search);
    const payload = await apiGet<{ conversations: Conversation[] }>(
      `/api/v1/conversations?${params.toString()}`
    );
    set({ conversations: payload.conversations ?? [], conversationsLoaded: true });
  },

  async loadConversation(id) {
    const payload = await apiGet<ConversationDetail>(`/api/v1/conversations/${id}`);
    set({
      current: {
        conversation: payload.conversation,
        messages: payload.messages ?? [],
      },
    });
    return payload;
  },

  async createConversation(title) {
    const payload = await apiPost<{ conversation: Conversation }>('/api/v1/conversations', {
      title,
    });
    const conversation = payload.conversation;
    set((state) => ({ conversations: [conversation, ...state.conversations] }));
    set({
      current: { conversation, messages: [] },
    });
    return conversation;
  },

  async renameConversation(id, title) {
    const payload = await apiPatch<{ conversation: Conversation }>(`/api/v1/conversations/${id}`, {
      title,
    });
    const updated = payload.conversation;
    set((state) => ({
      conversations: state.conversations.map((c) => (c._id === id ? updated : c)),
      current: state.current?.conversation._id === id
        ? { ...state.current, conversation: updated }
        : state.current,
    }));
  },

  async togglePinned(id, pinned) {
    const payload = await apiPatch<{ conversation: Conversation }>(`/api/v1/conversations/${id}`, {
      pinned,
    });
    const updated = payload.conversation;
    set((state) => ({
      conversations: state.conversations
        .map((c) => (c._id === id ? updated : c))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
      current: state.current?.conversation._id === id
        ? { ...state.current, conversation: updated }
        : state.current,
    }));
  },

  async archiveConversation(id, isArchived) {
    const payload = await apiPatch<{ conversation: Conversation }>(`/api/v1/conversations/${id}`, {
      isArchived,
    });
    const updated = payload.conversation;
    set((state) => ({
      conversations: state.conversations.map((c) => (c._id === id ? updated : c)),
    }));
  },

  async deleteConversation(id) {
    await apiDelete(`/api/v1/conversations/${id}`);
    set((state) => ({
      conversations: state.conversations.filter((c) => c._id !== id),
      current: state.current?.conversation._id === id ? null : state.current,
    }));
  },

  async clearAll() {
    await apiDelete('/api/v1/conversations/clear-all');
    set({ conversations: [], current: null });
  },

  appendLocalMessage(message) {
    set((state) => {
      if (!state.current || state.current.conversation._id !== message.conversation) return state;
      return {
        current: {
          ...state.current,
          conversation: {
            ...state.current.conversation,
            lastMessageAt: message.createdAt,
          },
          messages: [...state.current.messages, message],
        },
      };
    });
  },

  updateLocalMessage(id, patch) {
    set((state) => {
      if (!state.current) return state;
      return {
        current: {
          ...state.current,
          messages: state.current.messages.map((m) =>
            m._id === id ? { ...m, ...patch } : m
          ),
        },
      };
    });
  },

  setStreaming(streaming) {
    set({ isStreaming: streaming });
  },

  setCurrent(current) {
    set({ current });
  },

  reset() {
    set({ conversations: [], conversationsLoaded: false, current: null, isStreaming: false });
  },
}));
