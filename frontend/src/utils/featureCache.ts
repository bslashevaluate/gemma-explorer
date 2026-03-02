const CACHE_KEY = 'gemma-explorer:feature-explanations';

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function getCachedExplanation(layer: number, index: number): string | undefined {
  return load()[`${layer}:${index}`];
}

export function setCachedExplanation(layer: number, index: number, explanation: string): void {
  const cache = load();
  cache[`${layer}:${index}`] = explanation;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full — silently skip
  }
}
