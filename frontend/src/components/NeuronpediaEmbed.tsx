import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NeuronpediaEmbedProps {
  layer: number;
  featureIndex: number;
}

export function NeuronpediaEmbed({ layer, featureIndex }: NeuronpediaEmbedProps) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = `https://www.neuronpedia.org/gemma-2-2b/${layer}-gemmascope-res-16k/${featureIndex}?embed=true`;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Neuronpedia Dashboard
      </button>
      {expanded && (
        <iframe
          src={embedUrl}
          className="w-full h-96 border-t border-gray-700"
          title={`Feature L${layer} #${featureIndex}`}
        />
      )}
    </div>
  );
}
