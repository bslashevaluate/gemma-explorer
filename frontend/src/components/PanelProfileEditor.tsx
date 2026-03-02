import { useState, useRef, useEffect } from 'react';
import { Settings, X, ChevronUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useComparisonStore, makeBundleId } from '../stores/comparisonStore';
import { useConceptStore, type SelectedFeature } from '../stores/conceptStore';
import { listFeatureSets, type FeatureSet } from '../api/client';
import type { PanelProfile, FeatureBundle } from '../types/chat';

interface PanelProfileEditorProps {
  tabId: string;
  side: 'left' | 'right';
  panel: PanelProfile;
}

export function PanelProfileEditor({ tabId, side, panel }: PanelProfileEditorProps) {
  const [open, setOpen] = useState(false);
  const [librarySets, setLibrarySets] = useState<FeatureSet[]>([]);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);
  const store = useComparisonStore();
  const { discoveredFeatures, concept } = useConceptStore();

  useEffect(() => {
    if (open) {
      listFeatureSets().then(setLibrarySets).catch(() => {});
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const addFromLibrary = (fs: FeatureSet) => {
    const features: SelectedFeature[] = fs.features.map((f) => ({
      ...f,
      concept_text: fs.concept,
      enabled: true,
    }));
    const bundle: FeatureBundle = {
      id: makeBundleId(),
      name: fs.name,
      features,
      enabled: true,
    };
    store.addPanelBundle(tabId, side, bundle);
  };

  const addFromDiscovery = () => {
    if (discoveredFeatures.length === 0) return;
    const bundle: FeatureBundle = {
      id: makeBundleId(),
      name: concept || 'Discovery',
      features: [...discoveredFeatures],
      enabled: true,
    };
    store.addPanelBundle(tabId, side, bundle);
  };

  const toggleExpanded = (bundleId: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded p-1 hover:bg-gray-700 text-gray-500 hover:text-gray-300"
        title="Edit panel profile"
      >
        <Settings size={13} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-8 right-0 z-50 w-80 rounded-lg border border-gray-700 bg-gray-900 shadow-xl p-3 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-300">Panel Profile</h4>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
              <X size={13} />
            </button>
          </div>

          {/* Add bundle actions */}
          <div className="space-y-1.5">
            <button
              onClick={addFromDiscovery}
              disabled={discoveredFeatures.length === 0}
              className="w-full rounded bg-indigo-600/20 px-2 py-1.5 text-xs text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
              + Add Current Discovery{concept ? ` ("${concept}")` : ''}
            </button>

            {librarySets.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Add from Library</p>
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {librarySets.map((fs) => (
                    <button
                      key={fs.id}
                      onClick={() => addFromLibrary(fs)}
                      className="w-full rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200 text-left truncate"
                    >
                      + {fs.name} ({fs.features.length} features)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bundle stack */}
          {panel.bundles.length > 0 && (
            <div className="border-t border-gray-700 pt-2 space-y-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Feature Bundles</p>
              {panel.bundles.map((bundle, idx) => {
                const isExpanded = expandedBundles.has(bundle.id);
                const activeCount = bundle.features.filter((f) => f.enabled).length;
                return (
                  <div key={bundle.id} className="rounded border border-gray-700 bg-gray-800/50">
                    {/* Bundle header */}
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={bundle.enabled}
                        onChange={() => store.togglePanelBundle(tabId, side, bundle.id)}
                        className="accent-indigo-500 shrink-0"
                      />
                      <button
                        onClick={() => toggleExpanded(bundle.id)}
                        className="text-gray-500 hover:text-gray-300 shrink-0"
                      >
                        <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <span className={`flex-1 text-xs truncate ${bundle.enabled ? 'text-gray-200' : 'text-gray-500'}`}>
                        {bundle.name}
                        <span className="text-gray-500 ml-1">({activeCount})</span>
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => store.movePanelBundle(tabId, side, bundle.id, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <button
                          onClick={() => store.movePanelBundle(tabId, side, bundle.id, 'down')}
                          disabled={idx === panel.bundles.length - 1}
                          className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                        >
                          <ChevronDown size={11} />
                        </button>
                        <button
                          onClick={() => store.removePanelBundle(tabId, side, bundle.id)}
                          className="p-0.5 text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded feature list */}
                    {isExpanded && (
                      <div className="border-t border-gray-700 px-2 py-1.5 space-y-1 max-h-32 overflow-y-auto">
                        {bundle.features.map((f) => (
                          <div
                            key={`${f.layer}-${f.feature_index}`}
                            className="flex items-center gap-1.5 text-[11px]"
                          >
                            <input
                              type="checkbox"
                              checked={f.enabled}
                              onChange={() => store.toggleBundleFeature(tabId, side, bundle.id, f.layer, f.feature_index)}
                              className="accent-indigo-500"
                            />
                            <span className="rounded bg-indigo-800 px-0.5 py-px font-mono text-[9px]">
                              L{f.layer}
                            </span>
                            <span className="flex-1 text-gray-400 truncate">
                              {f.explanation || `#${f.feature_index}`}
                            </span>
                            <input
                              type="range"
                              min={0} max={100} value={f.alpha}
                              onChange={(e) =>
                                store.setBundleFeatureAlpha(tabId, side, bundle.id, f.layer, f.feature_index, Number(e.target.value))
                              }
                              className="w-12 h-1 accent-indigo-500"
                            />
                            <span className="font-mono text-gray-500 w-5 text-right text-[9px]">{f.alpha}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {panel.bundles.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-2">
              No feature bundles. Use the buttons above to add.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
