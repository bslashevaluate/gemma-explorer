import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sparkles, MessageSquare, BookOpen } from 'lucide-react';
import { DiscoverPage } from './pages/DiscoverPage';
import { ChatPage } from './pages/ChatPage';
import { LibraryPage } from './pages/LibraryPage';

const queryClient = new QueryClient();

function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
    }`;

  return (
    <nav className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold text-gray-100">
          Concept Steering Explorer
        </span>
        <div className="flex items-center gap-1">
          <NavLink to="/" className={linkClass}>
            <Sparkles size={14} />
            Discover
          </NavLink>
          <NavLink to="/chat" className={linkClass}>
            <MessageSquare size={14} />
            Chat
          </NavLink>
          <NavLink to="/library" className={linkClass}>
            <BookOpen size={14} />
            Library
          </NavLink>
        </div>
      </div>
      <span className="text-xs text-gray-600">Gemma 2 2B + Gemma Scope SAEs</span>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <NavBar />
          <main className="mx-auto max-w-7xl px-6 py-6">
            <Routes>
              <Route path="/" element={<DiscoverPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/library" element={<LibraryPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
