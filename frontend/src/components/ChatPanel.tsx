import { useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../api/client';
import { ChatMessage } from './ChatMessage';

interface ChatPanelProps {
  title: string;
  messages: ChatMessageType[];
  variant: 'steered' | 'baseline';
  onRedo?: () => void;
  isRedoing?: boolean;
}

export function ChatPanel({ title, messages, variant, onRedo, isRedoing }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full rounded-lg border border-gray-700 bg-gray-900/50">
      <div
        className={`flex items-center justify-between px-4 py-2 border-b border-gray-700 text-sm font-medium ${
          variant === 'steered' ? 'text-indigo-400' : 'text-gray-400'
        }`}
      >
        <span>{title}</span>
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={isRedoing || messages.length === 0}
            title="Redo last response"
            className="rounded p-1 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 hover:text-gray-300"
          >
            <RefreshCw size={13} className={isRedoing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-8">
            No messages yet. Send a message below.
          </p>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
