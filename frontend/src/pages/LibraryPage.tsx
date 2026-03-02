import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { listFeatureSets, deleteFeatureSet, type FeatureSet } from '../api/client';
import { useConceptStore } from '../stores/conceptStore';
import { useChatStore } from '../stores/chatStore';

export function LibraryPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<FeatureSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setConcept, setDiscoveredFeatures } = useConceptStore();
  const { clear: clearChat } = useChatStore();

  const fetchSets = async () => {
    try {
      const data = await listFeatureSets();
      setSets(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  const handleLoad = (fs: FeatureSet) => {
    setConcept(fs.concept);
    setDiscoveredFeatures(
      fs.features.map((f) => ({
        layer: f.layer,
        feature_index: f.feature_index,
        activation_strength: f.activation_strength,
        concept_text: fs.concept,
        alpha: f.alpha,
      })),
      true // preserve saved alpha values
    );
    clearChat();
    navigate('/chat');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeatureSet(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-gray-400">Loading library...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Feature Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Saved feature sets from previous discovery sessions.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {sets.length === 0 ? (
        <div className="rounded-lg border border-gray-800 py-16 text-center">
          <p className="text-gray-500">No saved feature sets yet.</p>
          <p className="text-sm text-gray-600 mt-1">
            Discover features and save them to build your library.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((fs) => (
            <div
              key={fs.id}
              className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 space-y-3"
            >
              <div>
                <h3 className="font-semibold text-gray-200">{fs.name}</h3>
                <p className="text-sm text-gray-400 mt-0.5">"{fs.concept}"</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{fs.features.length} features</span>
                <span>{new Date(fs.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleLoad(fs)}
                  className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  <MessageSquare size={12} />
                  Load & Chat
                </button>
                <button
                  onClick={() => handleDelete(fs.id)}
                  className="flex items-center gap-1.5 rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:bg-red-900 hover:text-red-300"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
