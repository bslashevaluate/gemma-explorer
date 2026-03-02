import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useComparisonStore } from '../stores/comparisonStore';

export function ComparisonTabBar() {
  const { tabs, activeTabId, setActiveTab, addTab, removeTab, renameTab } = useComparisonStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const startRename = (tabId: string, currentName: string) => {
    setEditingId(tabId);
    setEditText(currentName);
  };

  const commitRename = () => {
    if (editingId && editText.trim()) {
      renameTab(editingId, editText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex items-center gap-1 border-b border-gray-700 px-2 py-1 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`group flex items-center gap-1 rounded-t-md px-3 py-1.5 text-xs cursor-pointer shrink-0 ${
            tab.id === activeTabId
              ? 'bg-gray-800 text-gray-200 border border-gray-700 border-b-gray-800'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
          }`}
          onClick={() => setActiveTab(tab.id)}
          onDoubleClick={() => startRename(tab.id, tab.name)}
        >
          {editingId === tab.id ? (
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-b border-indigo-500 text-xs text-gray-200 outline-none w-24"
            />
          ) : (
            <span className="truncate max-w-[120px]">{tab.name}</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTab(tab.id);
            }}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-gray-600 text-gray-500 hover:text-gray-300"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => addTab()}
        className="rounded p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 shrink-0"
        title="Add comparison tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
