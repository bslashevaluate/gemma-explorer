import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { useConceptStore } from '../stores/conceptStore';
import { discoverFeatures } from '../api/client';

export function ConceptInput() {
  const {
    concept,
    setConcept,
    setDiscoveredFeatures,
    setIsDiscovering,
    isDiscovering,
    discoveryMode,
    setDiscoveryMode,
  } = useConceptStore();
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    if (!concept.trim()) return;
    setError(null);
    setIsDiscovering(true);
    try {
      const result = await discoverFeatures({
        concept: concept.trim(),
        contrastive: discoveryMode === 'contrastive',
      });
      setDiscoveredFeatures(result.features);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleDiscover();
            }
          }}
          placeholder="Describe a concept to explore... (e.g., 'the smell of resin from trees on a hot day')"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 pr-12 text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none resize-none"
          rows={2}
          disabled={isDiscovering}
        />
        <Sparkles
          size={18}
          className="absolute right-4 top-4 text-gray-600"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleDiscover}
          disabled={isDiscovering || !concept.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search size={16} />
          {isDiscovering ? 'Discovering...' : 'Discover Features'}
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={discoveryMode === 'contrastive'}
            onChange={(e) =>
              setDiscoveryMode(e.target.checked ? 'contrastive' : 'simple')
            }
            className="accent-indigo-500"
          />
          Contrastive mode
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
