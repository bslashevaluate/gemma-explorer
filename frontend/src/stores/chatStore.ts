import { create } from 'zustand';
import type { ChatMessage } from '../api/client';

interface ChatState {
  steeredMessages: ChatMessage[];
  baselineMessages: ChatMessage[];
  isGenerating: boolean;

  addUserMessage: (content: string) => void;
  addResponses: (steered: string, baseline: string) => void;
  addSteeredResponse: (content: string) => void;
  addBaselineResponse: (content: string) => void;
  popLastSteeredResponse: () => void;
  popLastBaselineResponse: () => void;
  setIsGenerating: (v: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  steeredMessages: [],
  baselineMessages: [],
  isGenerating: false,

  addUserMessage: (content) =>
    set((state) => ({
      steeredMessages: [...state.steeredMessages, { role: 'user', content }],
      baselineMessages: [...state.baselineMessages, { role: 'user', content }],
    })),

  addResponses: (steered, baseline) =>
    set((state) => ({
      steeredMessages: [...state.steeredMessages, { role: 'assistant', content: steered }],
      baselineMessages: [...state.baselineMessages, { role: 'assistant', content: baseline }],
    })),

  addSteeredResponse: (content) =>
    set((state) => ({
      steeredMessages: [...state.steeredMessages, { role: 'assistant', content }],
    })),

  addBaselineResponse: (content) =>
    set((state) => ({
      baselineMessages: [...state.baselineMessages, { role: 'assistant', content }],
    })),

  popLastSteeredResponse: () =>
    set((state) => {
      const msgs = [...state.steeredMessages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
      return { steeredMessages: msgs };
    }),

  popLastBaselineResponse: () =>
    set((state) => {
      const msgs = [...state.baselineMessages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
      return { baselineMessages: msgs };
    }),

  setIsGenerating: (v) => set({ isGenerating: v }),

  clear: () =>
    set({ steeredMessages: [], baselineMessages: [], isGenerating: false }),
}));
