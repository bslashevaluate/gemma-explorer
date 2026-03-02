import { useState } from 'react';
import { Send, Trash2, Plus } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { PromptLibrary } from './PromptLibrary';
import { GenerationSettings } from './GenerationSettings';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { chatStream, type ChatMessage } from '../api/client';

function buildPrompt(history: ChatMessage[], rawInput: string): string {
  if (history.length === 0) return rawInput;
  const formatted = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return formatted + '\n' + rawInput;
}

interface SinglePanelChatProps {
  onAddComparison: () => void;
}

export function SinglePanelChat({ onAddComparison }: SinglePanelChatProps) {
  const [input, setInput] = useState('');
  const {
    baselineMessages,
    isGenerating,
    addUserMessage,
    addBaselineResponse,
    setIsGenerating,
    clear,
  } = useChatStore();
  const { temperature, maxNewTokens, topK, topP, freqPenalty } = useSettingsStore();

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText || isGenerating) return;

    setInput('');
    addUserMessage(userText);
    setIsGenerating(true);

    try {
      const prompt = buildPrompt(baselineMessages, userText);
      const stream = chatStream({
        prompt,
        features: [],
        temperature,
        max_new_tokens: maxNewTokens,
        top_k: topK,
        top_p: topP,
        freq_penalty: freqPenalty,
        side: 'baseline',
      });
      for await (const event of stream) {
        if (event.type === 'baseline') addBaselineResponse(event.content);
        else if (event.type === 'error') addBaselineResponse(`Error: ${event.detail}`);
      }
    } catch (e: any) {
      addBaselineResponse(`Error: ${e.message || 'Generation failed'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    clear();
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400">Chat (no features)</h2>
        <button
          onClick={onAddComparison}
          className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
        >
          <Plus size={13} />
          Add Comparison
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <ChatPanel
          title="Baseline"
          messages={baselineMessages}
          variant="baseline"
        />
      </div>

      <div className="mt-3 flex gap-2 items-end">
        <GenerationSettings />
        <PromptLibrary onInsert={(text) => setInput(text)} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isGenerating}
          rows={2}
          placeholder="Type anything — raw text, User:/Assistant: format, or any prompt style. Shift+Enter for newline."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={isGenerating || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {isGenerating ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send size={16} />
          )}
        </button>
        <button
          onClick={handleClear}
          disabled={isGenerating || baselineMessages.length === 0}
          title="Clear chat"
          className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed self-end"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
