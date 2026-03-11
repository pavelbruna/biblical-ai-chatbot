'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  correctedContent?: string | null;
  canEdit?: boolean;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to UI
    setMessages(prev => [
      ...prev,
      { id: Date.now(), role: 'user', content: userMessage },
    ]);

    try {
      // Prepare conversation history (all previous messages)
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.correctedContent || msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      const assistantMsgId = Date.now() + 1;
      setMessages(prev => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '' },
      ]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage += chunk;

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: assistantMessage }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      alert('Chyba při komunikaci s chatbotem');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrect = async (messageId: number) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch('/api/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          correctedContent: editContent,
        }),
      });

      if (!response.ok) throw new Error('Correction failed');

      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, correctedContent: editContent }
            : msg
        )
      );

      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error('Correction error:', error);
      alert('Chyba při ukládání opravy');
    }
  };

  const canEdit = session?.user?.role === 'expert' || session?.user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-amber-600/30 bg-slate-900/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-400">
            Biblický AI Asistent
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {session?.user?.email} ({session?.user?.role})
            </span>
            {session?.user?.role === 'admin' && (
              <a
                href="/admin"
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 rounded text-sm"
              >
                Admin
              </a>
            )}
            <button
              onClick={() => signOut()}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Odhlásit
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-slate-800/50 rounded-lg shadow-2xl border border-amber-600/20 h-[calc(100vh-200px)] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-12">
                <p className="text-lg">Zeptejte se na cokoliv z Bible 21</p>
                <p className="text-sm mt-2">
                  Odpovědi jsou generovány pouze z biblického kontextu
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.role === 'user'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-100'
                  }`}
                >
                  {editingMessageId === msg.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full bg-slate-600 p-2 rounded text-sm"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCorrect(msg.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Uložit
                        </button>
                        <button
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditContent('');
                          }}
                          className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm"
                        >
                          Zrušit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">
                        {msg.correctedContent || msg.content}
                      </p>
                      {msg.correctedContent && (
                        <p className="text-xs text-amber-300 mt-2">
                          ✓ Opraveno expertem
                        </p>
                      )}
                      {msg.role === 'assistant' && canEdit && !msg.correctedContent && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditContent(msg.content);
                          }}
                          className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                        >
                          Opravit odpověď
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-amber-600/20 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Zeptejte se na cokoliv z Bible..."
                disabled={loading}
                className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
              >
                {loading ? 'Načítám...' : 'Odeslat'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
