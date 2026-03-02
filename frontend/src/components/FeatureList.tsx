import { useConceptStore } from '../stores/conceptStore';
import { FeatureCard } from './FeatureCard';

export function FeatureList() {
  const { discoveredFeatures, isDiscovering, enableAll, disableAll } = useConceptStore();

  if (isDiscovering) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="ml-3 text-gray-400">
          Running model inference and SAE encoding...
        </span>
      </div>
    );
  }

  if (discoveredFeatures.length === 0) {
    return null;
  }

  const enabledCount = discoveredFeatures.filter((f) => f.enabled).length;
  const allEnabled = enabledCount === discoveredFeatures.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">
          Discovered Features
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={allEnabled ? disableAll : enableAll}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {allEnabled ? 'Disable all' : 'Enable all'}
          </button>
          <span className="text-sm text-gray-500">
            {enabledCount} of {discoveredFeatures.length} enabled
          </span>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {discoveredFeatures.map((f) => (
          <FeatureCard
            key={`${f.layer}-${f.feature_index}`}
            feature={f}
          />
        ))}
      </div>
    </div>
  );
}
