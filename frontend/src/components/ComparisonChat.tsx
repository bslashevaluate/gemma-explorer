import { useState, useEffect } from 'react';
import { Send, Trash2, RefreshCw } from 'lucide-react';
import { ComparisonTabBar } from './ComparisonTabBar';
import { PanelProfileEditor } from './PanelProfileEditor';
import { PromptLibrary } from './PromptLibrary';
import { GenerationSettings } from './GenerationSettings';
import { ChatPanel } from './ChatPanel';
import { useComparisonStore, getActiveFeatures } from '../stores/comparisonStore';
import { useSettingsStore } from '../stores/settingsStore';
import { chatStream, type ChatMessage } from '../api/client';
import type { PanelProfile } from '../types/chat';

type PanelSide = 'left' | 'right';

/** Prepend conversation history, then append the user's raw input unchanged. */
function buildPrompt(history: ChatMessage[], rawInput: string): string {
  if (history.length === 0) return rawInput;
  const formatted = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return formatted + '\n' + rawInput;
}

export function ComparisonChat() {
  const [input, setInput] = useState('');
  const store = useComparisonStore();
  const { temperature, maxNewTokens, topK, topP, freqPenalty, globalAlphaMultiplier } = useSettingsStore();

  const tab = store.getActiveTab();

  // Reset input on tab switch
  const tabId = tab?.id;
  useEffect(() => {
    setInput('');
  }, [tabId]);

  if (!tab) return null;

  const anyGenerating = tab.leftPanel.isGenerating || tab.rightPanel.isGenerating;

  const generateForPanel = async (tabId: string, side: PanelSide, panel: PanelProfile, rawPrompt: string) => {
    const activeFeatures = getActiveFeatures(panel);
    store.setPanelGenerating(tabId, side, true);
    try {
      const stream = chatStream({
        prompt: rawPrompt,
        features: activeFeatures.map((f) => ({
          layer: f.layer,
          feature_index: f.feature_index,
          alpha: f.alpha * globalAlphaMultiplier,
        })),
        temperature,
        max_new_tokens: maxNewTokens,
        top_k: topK,
        top_p: topP,
        freq_penalty: freqPenalty,
        side: activeFeatures.length > 0 ? 'steered' : 'baseline',
      });
      for await (const event of stream) {
        if (event.type === 'steered' || event.type === 'baseline') {
          store.addPanelResponse(tabId, side, event.content);
        } else if (event.type === 'error') {
          store.addPanelResponse(tabId, side, `Error: ${event.detail}`);
        }
      }
    } catch (e: any) {
      store.addPanelResponse(tabId, side, `Error: ${e.message || 'Generation failed'}`);
    } finally {
      store.setPanelGenerating(tabId, side, false);
    }
  };

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText || anyGenerating) return;

    setInput('');

    store.addUserMessage(tab.id, userText);

    // Re-read the tab after adding user message so messages are up-to-date
    const freshTab = useComparisonStore.getState().tabs.find((t) => t.id === tab.id);
    if (!freshTab) return;

    // History = everything before the just-added user message; raw input appended as-is
    const leftHistory = freshTab.leftPanel.messages.slice(0, -1);
    const rightHistory = freshTab.rightPanel.messages.slice(0, -1);
    const leftPrompt = buildPrompt(leftHistory, userText);
    const rightPrompt = buildPrompt(rightHistory, userText);

    // Fire both panels concurrently (backend lock prevents hook contamination)
    await Promise.all([
      generateForPanel(tab.id, 'left', freshTab.leftPanel, leftPrompt),
      generateForPanel(tab.id, 'right', freshTab.rightPanel, rightPrompt),
    ]);
  };

  const handleRedo = (side: PanelSide) => async () => {
    const currentTab = useComparisonStore.getState().tabs.find((t) => t.id === tab.id);
    if (!currentTab) return;
    const panel = side === 'left' ? currentTab.leftPanel : currentTab.rightPanel;

    const lastUserIdx = [...panel.messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;

    store.popPanelResponse(tab.id, side);

    const updated = useComparisonStore.getState().tabs.find((t) => t.id === tab.id);
    if (!updated) return;
    const updatedPanel = side === 'left' ? updated.leftPanel : updated.rightPanel;

    const lastMsg = updatedPanel.messages[updatedPanel.messages.length - 1];
    const history = updatedPanel.messages.slice(0, -1);
    const prompt = buildPrompt(history, lastMsg?.content ?? '');
    await generateForPanel(tab.id, side, updatedPanel, prompt);
  };

  const handleClear = () => {
    store.clearMessages(tab.id);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <ComparisonTabBar />

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 mt-3">
        {(['left', 'right'] as const).map((side) => {
          const panel = side === 'left' ? tab.leftPanel : tab.rightPanel;
          const activeCount = getActiveFeatures(panel).length;
          const bundleCount = panel.bundles.filter((b) => b.enabled).length;
          const label = activeCount > 0
            ? `${panel.label} (${bundleCount} bundle${bundleCount !== 1 ? 's' : ''}, ${activeCount} features)`
            : `${panel.label} (baseline)`;

          return (
            <div key={side} className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 px-1">
                <span className={`text-xs font-medium ${activeCount > 0 ? 'text-indigo-400' : 'text-gray-400'}`}>
                  {label}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRedo(side)}
                    disabled={panel.isGenerating || panel.messages.length === 0}
                    title="Redo last response"
                    className="rounded p-1 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 hover:text-gray-300"
                  >
                    <RefreshCw size={12} className={panel.isGenerating ? 'animate-spin' : ''} />
                  </button>
                  <PanelProfileEditor tabId={tab.id} side={side} panel={panel} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatPanel
                  title={label}
                  messages={panel.messages}
                  variant={activeCount > 0 ? 'steered' : 'baseline'}
                />
              </div>
            </div>
          );
        })}
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
          disabled={anyGenerating}
          rows={2}
          placeholder="Type anything — raw text, User:/Assistant: format, or any prompt style. Shift+Enter for newline."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={anyGenerating || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {anyGenerating ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send size={16} />
          )}
        </button>
        <button
          onClick={handleClear}
          disabled={anyGenerating || (tab.leftPanel.messages.length === 0 && tab.rightPanel.messages.length === 0)}
          title="Clear chat"
          className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed self-end"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
