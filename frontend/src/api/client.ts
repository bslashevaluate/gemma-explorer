import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// --- Types ---

export interface DiscoveredFeature {
  layer: number;
  feature_index: number;
  activation_strength: number;
  concept_text: string;
  cluster_id?: number;
}

export interface DiscoverRequest {
  concept: string;
  top_k?: number;
  contrastive?: boolean;
  neutral_texts?: string[];
}

export interface DiscoverResponse {
  concept: string;
  features: DiscoveredFeature[];
  mode: string;
}

export interface NearbyRequest {
  layer: number;
  feature_index: number;
  top_k?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ActiveFeature {
  layer: number;
  feature_index: number;
  alpha: number;
}

export interface ChatRequest {
  messages?: ChatMessage[];
  prompt?: string;
  features: ActiveFeature[];
  max_new_tokens?: number;
  temperature?: number;
  top_k?: number | null;
  top_p?: number | null;
  freq_penalty?: number;
  side?: 'steered' | 'baseline' | 'both';
}

export interface ChatResponse {
  steered_response: string;
  baseline_response: string;
}

export interface FeatureExplanation {
  description: string;
  score: number | null;
}

export interface NeuronpediaFeature {
  model_id: string;
  layer: number;
  feature_index: number;
  source: string;
  explanations: FeatureExplanation[];
  neuronpedia_url: string;
  embed_url: string;
}

export interface NeuronpediaSearchResult {
  model_id: string;
  layer: number;
  feature_index: number;
  description: string;
  score: number | null;
  neuronpedia_url: string;
}

// --- API calls ---

export async function discoverFeatures(req: DiscoverRequest): Promise<DiscoverResponse> {
  const { data } = await api.post<DiscoverResponse>('/discover', req);
  return data;
}

export async function discoverNearbyFeatures(req: NearbyRequest): Promise<DiscoverResponse> {
  const { data } = await api.post<DiscoverResponse>('/discover/nearby', req);
  return data;
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', req);
  return data;
}

export type ChatStreamEvent =
  | { type: 'steered' | 'baseline'; content: string }
  | { type: 'error'; detail: string };

export async function* chatStream(req: ChatRequest): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail ?? 'Stream request failed');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      try {
        yield JSON.parse(payload) as ChatStreamEvent;
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export async function getFeature(layer: number, index: number): Promise<NeuronpediaFeature> {
  const { data } = await api.get<NeuronpediaFeature>(`/features/${layer}/${index}`);
  return data;
}

export async function searchFeatures(query: string, layers?: number[]): Promise<NeuronpediaSearchResult[]> {
  const { data } = await api.post<NeuronpediaSearchResult[]>('/features/search', { query, layers });
  return data;
}

export async function getEmbedUrl(layer: number, index: number): Promise<{ url: string; neuronpedia_url: string }> {
  const { data } = await api.get(`/neuronpedia/embed-url/${layer}/${index}`);
  return data;
}

// --- Library ---

export interface SavedFeature {
  layer: number;
  feature_index: number;
  activation_strength: number;
  alpha: number;
  explanation: string;
}

export interface FeatureSet {
  id: string;
  name: string;
  concept: string;
  features: SavedFeature[];
  created_at: string;
}

export async function listFeatureSets(): Promise<FeatureSet[]> {
  const { data } = await api.get<FeatureSet[]>('/library');
  return data;
}

export async function createFeatureSet(req: { name: string; concept: string; features: SavedFeature[] }): Promise<FeatureSet> {
  const { data } = await api.post<FeatureSet>('/library', req);
  return data;
}

export async function getFeatureSet(id: string): Promise<FeatureSet> {
  const { data } = await api.get<FeatureSet>(`/library/${id}`);
  return data;
}

export async function deleteFeatureSet(id: string): Promise<void> {
  await api.delete(`/library/${id}`);
}

export async function healthCheck(): Promise<{ status: string }> {
  const { data } = await api.get('/health');
  return data;
}

// --- Prompt Library ---

export interface SavedPrompt {
  id: string;
  text: string;
  label: string;
  created_at: string;
}

export async function listPrompts(): Promise<SavedPrompt[]> {
  const { data } = await api.get<SavedPrompt[]>('/prompts');
  return data;
}

export async function createPrompt(req: { text: string; label: string }): Promise<SavedPrompt> {
  const { data } = await api.post<SavedPrompt>('/prompts', req);
  return data;
}

export async function updatePrompt(id: string, req: { text?: string; label?: string }): Promise<SavedPrompt> {
  const { data } = await api.put<SavedPrompt>(`/prompts/${id}`, req);
  return data;
}

export async function deletePrompt(id: string): Promise<void> {
  await api.delete(`/prompts/${id}`);
}
