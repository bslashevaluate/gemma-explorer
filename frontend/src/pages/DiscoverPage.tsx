import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { ConceptInput } from '../components/ConceptInput';
import { FeatureList } from '../components/FeatureList';
import { SaveToLibrary } from '../components/SaveToLibrary';
import { useConceptStore } from '../stores/conceptStore';

export function DiscoverPage() {
  const navigate = useNavigate();
  const { discoveredFeatures } = useConceptStore();
  const hasFeatures = discoveredFeatures.length > 0;
  const enabledCount = discoveredFeatures.filter((f) => f.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Discover Concepts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Describe a concept and discover which SAE features in Gemma 2 2B correspond to it.
        </p>
      </div>

      <ConceptInput />
      <FeatureList />

      {hasFeatures && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => navigate('/chat')}
            disabled={enabledCount === 0}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare size={16} />
            Open in Chat ({enabledCount} features)
          </button>
          <SaveToLibrary />
        </div>
      )}
    </div>
  );
}
