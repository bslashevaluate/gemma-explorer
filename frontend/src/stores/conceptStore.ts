import { create } from 'zustand';
import type { DiscoveredFeature } from '../api/client';

export interface SelectedFeature extends DiscoveredFeature {
  enabled: boolean;
  alpha: number;
  explanation?: string;
}

interface ConceptState {
  concept: string;
  discoveredFeatures: SelectedFeature[];
  isDiscovering: boolean;
  discoveryMode: 'simple' | 'contrastive';

  setConcept: (concept: string) => void;
  setDiscoveredFeatures: (features: DiscoveredFeature[], preserveAlpha?: boolean) => void;
  setIsDiscovering: (v: boolean) => void;
  setDiscoveryMode: (mode: 'simple' | 'contrastive') => void;
  toggleFeature: (layer: number, index: number) => void;
  toggleCluster: (clusterId: number | undefined, enabled: boolean) => void;
  addNearbyFeatures: (features: DiscoveredFeature[], parentClusterId?: number) => void;
  setFeatureAlpha: (layer: number, index: number, alpha: number) => void;
  setFeatureExplanation: (layer: number, index: number, explanation: string) => void;
  enableAll: () => void;
  disableAll: () => void;
  getActiveFeatures: () => SelectedFeature[];
  clear: () => void;
}

export const useConceptStore = create<ConceptState>((set, get) => ({
  concept: '',
  discoveredFeatures: [],
  isDiscovering: false,
  discoveryMode: 'simple',

  setConcept: (concept) => set({ concept }),

  setDiscoveredFeatures: (features, preserveAlpha) =>
    set({
      discoveredFeatures: features.map((f) => ({
        ...f,
        enabled: true,
        alpha: preserveAlpha && 'alpha' in f ? (f as any).alpha : 10.0,
      })),
    }),

  setIsDiscovering: (v) => set({ isDiscovering: v }),
  setDiscoveryMode: (mode) => set({ discoveryMode: mode }),

  toggleFeature: (layer, index) =>
    set((state) => ({
      discoveredFeatures: state.discoveredFeatures.map((f) =>
        f.layer === layer && f.feature_index === index
          ? { ...f, enabled: !f.enabled }
          : f
      ),
    })),

  toggleCluster: (clusterId, enabled) =>
    set((state) => ({
      discoveredFeatures: state.discoveredFeatures.map((f) =>
        f.cluster_id === clusterId ? { ...f, enabled } : f
      ),
    })),

  addNearbyFeatures: (features, parentClusterId) =>
    set((state) => {
      const existing = new Set(
        state.discoveredFeatures.map((f) => `${f.layer}-${f.feature_index}`)
      );
      const newFeatures = features
        .filter((f) => !existing.has(`${f.layer}-${f.feature_index}`))
        .map((f) => ({
          ...f,
          enabled: true,
          alpha: 10.0,
          cluster_id: parentClusterId !== undefined ? parentClusterId : f.cluster_id,
        }));
      return {
        discoveredFeatures: [...state.discoveredFeatures, ...newFeatures],
      };
    }),

  setFeatureAlpha: (layer, index, alpha) =>
    set((state) => ({
      discoveredFeatures: state.discoveredFeatures.map((f) =>
        f.layer === layer && f.feature_index === index
          ? { ...f, alpha }
          : f
      ),
    })),

  setFeatureExplanation: (layer, index, explanation) =>
    set((state) => ({
      discoveredFeatures: state.discoveredFeatures.map((f) =>
        f.layer === layer && f.feature_index === index
          ? { ...f, explanation }
          : f
      ),
    })),

  enableAll: () =>
    set((state) => ({
      discoveredFeatures: state.discoveredFeatures.map((f) => ({ ...f, enabled: true })),
    })),

  disableAll: () =>
    set((state) => ({
      discoveredFeatures: state.discoveredFeatures.map((f) => ({ ...f, enabled: false })),
    })),

  getActiveFeatures: () =>
    get().discoveredFeatures.filter((f) => f.enabled),

  clear: () =>
    set({ concept: '', discoveredFeatures: [], isDiscovering: false }),
}));
