import { useEffect, useState } from 'react';
import { ExternalLink, ToggleLeft, ToggleRight, Network } from 'lucide-react';
import { getFeature, discoverNearbyFeatures } from '../api/client';
import { useConceptStore, type SelectedFeature } from '../stores/conceptStore';
import { getCachedExplanation, setCachedExplanation } from '../utils/featureCache';

export function FeatureCard({ feature }: { feature: SelectedFeature }) {
  const { toggleFeature, setFeatureAlpha, setFeatureExplanation, addNearbyFeatures } = useConceptStore();
  const [explanationFailed, setExplanationFailed] = useState(false);
  const [isFindingNearby, setIsFindingNearby] = useState(false);

  const handleFindNearby = async () => {
    if (isFindingNearby) return;
    setIsFindingNearby(true);
    try {
      const res = await discoverNearbyFeatures({ layer: feature.layer, feature_index: feature.feature_index, top_k: 10 });
      // Exclude the feature itself just in case it's returned
      const newFeatures = res.features.filter(f => !(f.layer === feature.layer && f.feature_index === feature.feature_index));
      addNearbyFeatures(newFeatures, feature.cluster_id);
    } catch (e) {
      console.error("Failed to find nearby features", e);
    } finally {
      setIsFindingNearby(false);
    }
  };

  useEffect(() => {
    if (feature.explanation) return;

    const cached = getCachedExplanation(feature.layer, feature.feature_index);
    if (cached) {
      setFeatureExplanation(feature.layer, feature.feature_index, cached);
      return;
    }

    if (explanationFailed) return;

    getFeature(feature.layer, feature.feature_index)
      .then((data) => {
        const desc = data.explanations[0]?.description ?? 'No explanation available';
        setFeatureExplanation(feature.layer, feature.feature_index, desc);
        setCachedExplanation(feature.layer, feature.feature_index, desc);
      })
      .catch(() => {
        setExplanationFailed(true);
      });
  }, [feature.layer, feature.feature_index, feature.explanation, explanationFailed, setFeatureExplanation]);

  const maxStrength = 50;
  const barWidth = Math.min(100, (feature.activation_strength / maxStrength) * 100);

  let explanationText = feature.explanation;
  if (!explanationText) {
    explanationText = explanationFailed ? 'Explanation unavailable' : 'Loading...';
  }

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${feature.enabled
          ? 'border-indigo-400 bg-indigo-950/30'
          : 'border-gray-700 bg-gray-900/50 opacity-60'
        }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-xs font-mono font-bold">
            L{feature.layer}
          </span>
          <span className="text-sm font-mono text-gray-300">
            #{feature.feature_index}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {feature.activation_strength.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://www.neuronpedia.org/gemma-2-2b/${feature.layer}-gemmascope-res-16k/${feature.feature_index}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-indigo-400"
            title="View on Neuronpedia"
          >
            <ExternalLink size={14} />
          </a>
          <button
            onClick={handleFindNearby}
            disabled={isFindingNearby}
            className={`text-gray-400 hover:text-indigo-400 disabled:opacity-50 ${isFindingNearby ? 'animate-pulse' : ''}`}
            title="Find Nearby Features"
          >
            <Network size={14} />
          </button>
          <button
            onClick={() => toggleFeature(feature.layer, feature.feature_index)}
            className="text-gray-400 hover:text-white"
          >
            {feature.enabled ? <ToggleRight size={20} className="text-indigo-400" /> : <ToggleLeft size={20} />}
          </button>
        </div>
      </div>

      {/* Activation strength bar */}
      <div className="mb-2 h-1.5 w-full rounded-full bg-gray-700">
        <div
          className="h-1.5 rounded-full bg-indigo-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Explanation */}
      <p className={`text-xs mb-2 min-h-[1rem] ${explanationFailed ? 'text-gray-600 italic' : 'text-gray-400'}`}>
        {explanationText}
      </p>

      {/* Alpha slider */}
      {feature.enabled && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-6">α</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={feature.alpha}
            onChange={(e) =>
              setFeatureAlpha(feature.layer, feature.feature_index, Number(e.target.value))
            }
            className="flex-1 h-1 accent-indigo-500"
          />
          <span className="text-xs text-gray-400 w-8 text-right font-mono">
            {feature.alpha}
          </span>
        </div>
      )}
    </div>
  );
}
