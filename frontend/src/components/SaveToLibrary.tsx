import { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { createFeatureSet, type SavedFeature } from '../api/client';
import { useConceptStore } from '../stores/conceptStore';

export function SaveToLibrary() {
  const { concept, discoveredFeatures } = useConceptStore();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledFeatures = discoveredFeatures.filter((f) => f.enabled);

  const handleSave = async () => {
    if (!name.trim() || enabledFeatures.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const features: SavedFeature[] = enabledFeatures.map((f) => ({
        layer: f.layer,
        feature_index: f.feature_index,
        activation_strength: f.activation_strength,
        alpha: f.alpha,
        explanation: f.explanation || '',
      }));
      await createFeatureSet({ name: name.trim(), concept, features });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setName('');
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
        }}
        placeholder="Name this feature set..."
        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
      />
      <button
        onClick={handleSave}
        disabled={saving || !name.trim() || enabledFeatures.length === 0}
        className="flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saved ? <Check size={14} className="text-green-400" /> : <Save size={14} />}
        {saved ? 'Saved!' : 'Save to Library'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
