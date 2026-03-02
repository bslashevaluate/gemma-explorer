import { useConceptStore } from '../stores/conceptStore';

export function SteeringControls() {
  const { discoveredFeatures, toggleFeature, setFeatureAlpha } = useConceptStore();

  const activeFeatures = discoveredFeatures.filter((f) => f.enabled);

  return (
    <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <h3 className="text-sm font-semibold text-gray-300">Steering Controls</h3>

      <div>
        <p className="text-xs text-gray-500 mb-2">
          {activeFeatures.length} active feature{activeFeatures.length !== 1 && 's'}
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {discoveredFeatures.map((f) => (
            <div
              key={`${f.layer}-${f.feature_index}`}
              className="flex items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={() => toggleFeature(f.layer, f.feature_index)}
                className="accent-indigo-500"
              />
              <span className="rounded bg-indigo-800 px-1 py-0.5 font-mono text-[10px]">
                L{f.layer}
              </span>
              <span className="flex-1 text-gray-400 truncate">
                {f.explanation || `#${f.feature_index}`}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={f.alpha}
                onChange={(e) =>
                  setFeatureAlpha(f.layer, f.feature_index, Number(e.target.value))
                }
                className="w-16 h-1 accent-indigo-500"
              />
              <span className="font-mono text-gray-500 w-6 text-right">{f.alpha}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
