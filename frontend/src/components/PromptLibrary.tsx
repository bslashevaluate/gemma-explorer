import { useState, useRef, useEffect } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPrompts, createPrompt, updatePrompt, deletePrompt, type SavedPrompt } from '../api/client';

interface PromptLibraryProps {
  onInsert: (text: string) => void;
}

export function PromptLibrary({ onInsert }: PromptLibraryProps) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: prompts = [] } = useQuery({
    queryKey: ['prompts'],
    queryFn: listPrompts,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createPrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setAddingNew(false);
      setNewText('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; text?: string; label?: string }) =>
      updatePrompt(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePrompt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompts'] }),
  });

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

  const startEdit = (p: SavedPrompt) => {
    setEditingId(p.id);
    setEditText(p.text);
  };

  const commitEdit = () => {
    if (editingId && editText.trim()) {
      const label = editText.trim().slice(0, 60);
      updateMutation.mutate({ id: editingId, label, text: editText.trim() });
    }
  };

  const commitNew = () => {
    const text = newText.trim();
    if (text) {
      createMutation.mutate({ text, label: text.slice(0, 60) });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
        title="Prompt library"
      >
        <BookOpen size={16} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute bottom-12 left-0 z-50 w-80 rounded-lg border border-gray-700 bg-gray-900 shadow-xl p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-300">Prompt Library</h4>
            <button
              onClick={() => { setAddingNew(true); setNewText(''); }}
              className="text-gray-500 hover:text-gray-300"
              title="Add prompt"
            >
              <Plus size={14} />
            </button>
          </div>

          {addingNew && (
            <div className="space-y-1.5 border border-gray-700 rounded p-2">
              <textarea
                autoFocus
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Type a prompt to save..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitNew();
                  }
                }}
                className="w-full bg-transparent border border-gray-700 rounded text-xs text-gray-200 outline-none p-1.5 resize-none focus:border-indigo-500"
              />
              <div className="flex gap-1 justify-end">
                <button onClick={() => setAddingNew(false)} className="text-gray-500 hover:text-gray-300 p-1">
                  <X size={12} />
                </button>
                <button
                  onClick={commitNew}
                  disabled={!newText.trim()}
                  className="text-green-500 hover:text-green-400 p-1 disabled:opacity-40"
                >
                  <Check size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-1">
            {prompts.map((p) => (
              <div key={p.id} className="group">
                {editingId === p.id ? (
                  <div className="space-y-1 border border-gray-700 rounded p-2">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          commitEdit();
                        }
                      }}
                      className="w-full bg-transparent border border-gray-700 rounded text-xs text-gray-200 outline-none p-1.5 resize-none focus:border-indigo-500"
                    />
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300 p-1">
                        <X size={12} />
                      </button>
                      <button onClick={commitEdit} className="text-green-500 hover:text-green-400 p-1">
                        <Check size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-800 cursor-pointer"
                    onClick={() => { onInsert(p.text); setOpen(false); }}
                  >
                    <p className="flex-1 text-xs text-gray-300 truncate min-w-0">{p.text}</p>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                        className="p-1 text-gray-500 hover:text-gray-300"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {prompts.length === 0 && !addingNew && (
              <p className="text-xs text-gray-600 text-center py-3">
                No saved prompts yet. Click + to add one.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
