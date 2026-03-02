import type { ChatMessage } from '../api/client';
import type { SelectedFeature } from '../stores/conceptStore';

export interface FeatureBundle {
  id: string;
  name: string;
  features: SelectedFeature[];
  enabled: boolean;
}

export interface PanelProfile {
  id: string;
  label: string;
  bundles: FeatureBundle[];
  messages: ChatMessage[];
  isGenerating: boolean;
}

export interface ComparisonTab {
  id: string;
  name: string;
  leftPanel: PanelProfile;
  rightPanel: PanelProfile;
}
