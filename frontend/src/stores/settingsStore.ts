import { create } from 'zustand';

interface SettingsState {
  temperature: number;
  maxNewTokens: number;
  topK: number;
  topP: number;
  freqPenalty: number;
  globalAlphaMultiplier: number;

  setTemperature: (v: number) => void;
  setMaxNewTokens: (v: number) => void;
  setTopK: (v: number) => void;
  setTopP: (v: number) => void;
  setFreqPenalty: (v: number) => void;
  setGlobalAlphaMultiplier: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  temperature: 0.7,
  maxNewTokens: 256,
  topK: 64,
  topP: 0.95,
  freqPenalty: 0.0,
  globalAlphaMultiplier: 1.0,

  setTemperature: (v) => set({ temperature: v }),
  setMaxNewTokens: (v) => set({ maxNewTokens: v }),
  setTopK: (v) => set({ topK: v }),
  setTopP: (v) => set({ topP: v }),
  setFreqPenalty: (v) => set({ freqPenalty: v }),
  setGlobalAlphaMultiplier: (v) => set({ globalAlphaMultiplier: v }),
}));
