import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

export function GenerationSettings() {
  const [open, setOpen] = useState(false);
  const {
    temperature, setTemperature,
    maxNewTokens, setMaxNewTokens,
    topK, setTopK,
    topP, setTopP,
    freqPenalty, setFreqPenalty,
    globalAlphaMultiplier, setGlobalAlphaMultiplier,
  } = useSettingsStore();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
        title="Generation settings"
      >
        <Settings size={16} />
      </button>

      {open && (
        <div className="absolute bottom-12 left-0 z-50 w-64 rounded-lg border border-gray-700 bg-gray-900 shadow-xl p-3 space-y-3">
          <h4 className="text-xs font-semibold text-gray-300">Generation Settings</h4>

          <SliderControl label="Temperature" value={temperature} min={0} max={2} step={0.1}
            display={temperature.toFixed(1)} onChange={setTemperature} />

          <SliderControl label="Max response length" value={maxNewTokens} min={32} max={1024} step={32}
            display={String(maxNewTokens)} onChange={setMaxNewTokens} />

          <SliderControl label="Top-K" value={topK} min={1} max={500} step={1}
            display={String(topK)} onChange={setTopK} />

          <SliderControl label="Top-P" value={topP} min={0} max={1} step={0.05}
            display={topP.toFixed(2)} onChange={setTopP} />

          <SliderControl label="Freq penalty" value={freqPenalty} min={0} max={2} step={0.1}
            display={freqPenalty.toFixed(1)} onChange={setFreqPenalty} />

          <SliderControl label="Alpha multiplier" value={globalAlphaMultiplier} min={0} max={5} step={0.1}
            display={globalAlphaMultiplier.toFixed(1)} onChange={setGlobalAlphaMultiplier} />
        </div>
      )}
    </div>
  );
}

function SliderControl({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>{label}</span>
        <span className="font-mono text-gray-500">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-indigo-500"
      />
    </div>
  );
}
