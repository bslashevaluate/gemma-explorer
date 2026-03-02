import { create } from 'zustand';
import type { ChatMessage } from '../api/client';
import type { SelectedFeature } from './conceptStore';
import type { ComparisonTab, FeatureBundle, PanelProfile } from '../types/chat';

let nextBundleId = 1;
export function makeBundleId(): string {
  return `bundle-${nextBundleId++}`;
}

function makePanel(id: string, label: string): PanelProfile {
  return { id, label, bundles: [], messages: [], isGenerating: false };
}

let nextId = 1;
function makeTab(name?: string): ComparisonTab {
  const id = `tab-${nextId++}`;
  return {
    id,
    name: name ?? `Comparison ${nextId - 1}`,
    leftPanel: makePanel(`${id}-left`, 'Left'),
    rightPanel: makePanel(`${id}-right`, 'Right'),
  };
}

type PanelSide = 'left' | 'right';

function updateTab(
  tabs: ComparisonTab[],
  tabId: string,
  side: PanelSide,
  updater: (panel: PanelProfile) => PanelProfile,
): ComparisonTab[] {
  return tabs.map((t) => {
    if (t.id !== tabId) return t;
    const key = side === 'left' ? 'leftPanel' : 'rightPanel';
    return { ...t, [key]: updater(t[key]) };
  });
}

/** Collect all active features across all enabled bundles. */
export function getActiveFeatures(panel: PanelProfile): SelectedFeature[] {
  return panel.bundles
    .filter((b) => b.enabled)
    .flatMap((b) => b.features.filter((f) => f.enabled));
}

interface ComparisonState {
  tabs: ComparisonTab[];
  activeTabId: string | null;

  // Tab CRUD
  addTab: (name?: string) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, name: string) => void;

  // Per-panel bundles
  addPanelBundle: (tabId: string, side: PanelSide, bundle: FeatureBundle) => void;
  removePanelBundle: (tabId: string, side: PanelSide, bundleId: string) => void;
  togglePanelBundle: (tabId: string, side: PanelSide, bundleId: string) => void;
  movePanelBundle: (tabId: string, side: PanelSide, bundleId: string, direction: 'up' | 'down') => void;

  // Per-feature within bundle
  toggleBundleFeature: (tabId: string, side: PanelSide, bundleId: string, layer: number, featureIndex: number) => void;
  setBundleFeatureAlpha: (tabId: string, side: PanelSide, bundleId: string, layer: number, featureIndex: number, alpha: number) => void;

  // Per-panel messages
  addUserMessage: (tabId: string, content: string) => void;
  addPanelResponse: (tabId: string, side: PanelSide, content: string) => void;
  popPanelResponse: (tabId: string, side: PanelSide) => void;
  clearMessages: (tabId: string) => void;

  // Per-panel generation state
  setPanelGenerating: (tabId: string, side: PanelSide, generating: boolean) => void;

  // Helpers
  getActiveTab: () => ComparisonTab | null;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (name) => {
    const tab = makeTab(name);
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab.id;
  },

  removeTab: (tabId) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== tabId);
      let activeTabId = state.activeTabId;
      if (activeTabId === tabId) {
        activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      return { tabs, activeTabId };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  renameTab: (tabId, name) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)),
    })),

  addPanelBundle: (tabId, side, bundle) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({
        ...p,
        bundles: [...p.bundles, bundle],
      })),
    })),

  removePanelBundle: (tabId, side, bundleId) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({
        ...p,
        bundles: p.bundles.filter((b) => b.id !== bundleId),
      })),
    })),

  togglePanelBundle: (tabId, side, bundleId) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({
        ...p,
        bundles: p.bundles.map((b) =>
          b.id === bundleId ? { ...b, enabled: !b.enabled } : b,
        ),
      })),
    })),

  movePanelBundle: (tabId, side, bundleId, direction) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => {
        const bundles = [...p.bundles];
        const idx = bundles.findIndex((b) => b.id === bundleId);
        if (idx === -1) return p;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= bundles.length) return p;
        [bundles[idx], bundles[newIdx]] = [bundles[newIdx], bundles[idx]];
        return { ...p, bundles };
      }),
    })),

  toggleBundleFeature: (tabId, side, bundleId, layer, featureIndex) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({
        ...p,
        bundles: p.bundles.map((b) =>
          b.id !== bundleId ? b : {
            ...b,
            features: b.features.map((f) =>
              f.layer === layer && f.feature_index === featureIndex
                ? { ...f, enabled: !f.enabled }
                : f,
            ),
          },
        ),
      })),
    })),

  setBundleFeatureAlpha: (tabId, side, bundleId, layer, featureIndex, alpha) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({
        ...p,
        bundles: p.bundles.map((b) =>
          b.id !== bundleId ? b : {
            ...b,
            features: b.features.map((f) =>
              f.layer === layer && f.feature_index === featureIndex
                ? { ...f, alpha }
                : f,
            ),
          },
        ),
      })),
    })),

  addUserMessage: (tabId, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const msg: ChatMessage = { role: 'user', content };
        return {
          ...t,
          leftPanel: { ...t.leftPanel, messages: [...t.leftPanel.messages, msg] },
          rightPanel: { ...t.rightPanel, messages: [...t.rightPanel.messages, msg] },
        };
      }),
    })),

  addPanelResponse: (tabId, side, content) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({
        ...p,
        messages: [...p.messages, { role: 'assistant', content }],
      })),
    })),

  popPanelResponse: (tabId, side) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => {
        const msgs = [...p.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
        return { ...p, messages: msgs };
      }),
    })),

  clearMessages: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        return {
          ...t,
          leftPanel: { ...t.leftPanel, messages: [] },
          rightPanel: { ...t.rightPanel, messages: [] },
        };
      }),
    })),

  setPanelGenerating: (tabId, side, generating) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, side, (p) => ({ ...p, isGenerating: generating })),
    })),

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },
}));
