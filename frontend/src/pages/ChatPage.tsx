import { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel';
import { SteeringControls } from '../components/SteeringControls';
import { SinglePanelChat } from '../components/SinglePanelChat';
import { ComparisonChat } from '../components/ComparisonChat';
import { PromptLibrary } from '../components/PromptLibrary';
import { GenerationSettings } from '../components/GenerationSettings';
import { useConceptStore } from '../stores/conceptStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { chatStream, type ChatMessage } from '../api/client';

function buildPrompt(history: ChatMessage[], rawInput: string): string {
  if (history.length === 0) return rawInput;
  const formatted = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return formatted + '\n' + rawInput;
}

export function ChatPage() {
  const [input, setInput] = useState('');
  const { discoveredFeatures, concept } = useConceptStore();
  const [isRedoingSteered, setIsRedoingSteered] = useState(false);
  const [isRedoingBaseline, setIsRedoingBaseline] = useState(false);
  const {
    steeredMessages,
    baselineMessages,
    isGenerating,
    addUserMessage,
    addSteeredResponse,
    addBaselineResponse,
    popLastSteeredResponse,
    popLastBaselineResponse,
    setIsGenerating,
    clear,
  } = useChatStore();
  const { temperature, maxNewTokens, topK, topP, freqPenalty, globalAlphaMultiplier } = useSettingsStore();
  const { tabs, addTab } = useComparisonStore();

  const activeFeatures = discoveredFeatures.filter((f) => f.enabled);
  const hasAnyFeatures = discoveredFeatures.length > 0;
  const hasTabs = tabs.length > 0;

  // Mode: comparison tabs exist -> show comparison view
  if (hasTabs) {
    return <ComparisonChat />;
  }

  // Mode: no features and no tabs -> show single-panel chat
  if (!hasAnyFeatures) {
    return (
      <SinglePanelChat
        onAddComparison={() => addTab()}
      />
    );
  }

  // Mode: features loaded but no tabs -> legacy steered vs baseline layout
  const handleSend = async () => {
    const userText = input.trim();
    if (!userText || isGenerating) return;

    setInput('');
    addUserMessage(userText);
    setIsGenerating(true);

    try {
      const prompt = buildPrompt(steeredMessages, userText);
      const stream = chatStream({
        prompt,
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
      });
      for await (const event of stream) {
        if (event.type === 'steered') addSteeredResponse(event.content);
        else if (event.type === 'baseline') addBaselineResponse(event.content);
        else if (event.type === 'error') {
          addSteeredResponse(`Error: ${event.detail}`);
          addBaselineResponse(`Error: ${event.detail}`);
        }
      }
    } catch (e: any) {
      const detail = e.message || 'Generation failed';
      addSteeredResponse(`Error: ${detail}`);
      addBaselineResponse(`Error: ${detail}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const makeRedoHandler = (
    side: 'steered' | 'baseline',
    popFn: () => void,
    setRedoing: (v: boolean) => void,
    addFn: (c: string) => void,
  ) => async () => {
    const messages = side === 'steered' ? steeredMessages : baselineMessages;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;

    popFn();
    setRedoing(true);
    try {
      const history = messages.slice(0, messages.length - 1 - lastUserIdx);
      const lastUser = messages[messages.length - 1 - lastUserIdx];
      const prompt = buildPrompt(history, lastUser.content);
      const stream = chatStream({
        prompt,
        features: activeFeatures.map((f) => ({
          layer: f.layer,
          feature_index: f.feature_index,
          alpha: f.alpha * globalAlphaMultiplier,
        })),
        temperature,
        max_new_tokens: maxNewTokens,
        side,
      });
      for await (const event of stream) {
        if (event.type === side) addFn(event.content);
        else if (event.type === 'error') addFn(`Error: ${event.detail}`);
      }
    } catch (e: any) {
      addFn(`Error: ${e.message || 'Generation failed'}`);
    } finally {
      setRedoing(false);
    }
  };

  const handleRedoSteered = makeRedoHandler(
    'steered', popLastSteeredResponse, setIsRedoingSteered, addSteeredResponse,
  );
  const handleRedoBaseline = makeRedoHandler(
    'baseline', popLastBaselineResponse, setIsRedoingBaseline, addBaselineResponse,
  );

  const handleClear = () => {
    clear();
    setInput('');
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 overflow-y-auto">
        <div className="mb-3">
          <p className="text-xs text-gray-500">Active concept</p>
          <p className="text-sm text-gray-300 font-medium">
            {concept || 'Unnamed'}
          </p>
        </div>
        <SteeringControls />
        <button
          onClick={() => addTab()}
          className="mt-3 w-full rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700"
        >
          Switch to Comparison Tabs
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
          <ChatPanel
            title={`Steered (${activeFeatures.length} features)`}
            messages={steeredMessages}
            variant="steered"
            onRedo={handleRedoSteered}
            isRedoing={isRedoingSteered}
          />
          <ChatPanel
            title="Baseline"
            messages={baselineMessages}
            variant="baseline"
            onRedo={handleRedoBaseline}
            isRedoing={isRedoingBaseline}
          />
        </div>

        {/* Input */}
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
            disabled={isGenerating || (steeredMessages.length === 0 && baselineMessages.length === 0)}
            title="Clear chat"
            className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
