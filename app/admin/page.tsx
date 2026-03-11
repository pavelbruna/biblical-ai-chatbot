'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'prompt' | 'corrections'>('upload');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      redirect('/');
    }
  }, [session, status]);

  if (status === 'loading') {
    return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Načítám...</div>;
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
    redirect('/');
  }

  const handleUploadPDF = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      alert('PDF úspěšně nahráno a zpracováno!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Chyba při nahrávání PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrompt = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt }),
      });

      if (!response.ok) throw new Error('Update failed');

      alert('Systémový prompt aktualizován!');
    } catch (error) {
      console.error('Prompt update error:', error);
      alert('Chyba při aktualizaci promptu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-amber-600/30 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-400">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Zpět na chat
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded ${
              activeTab === 'upload'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Nahrát PDF
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-2 rounded ${
              activeTab === 'prompt'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Systémový Prompt
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-4 py-2 rounded ${
              activeTab === 'corrections'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Korekce
          </button>
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 rounded-lg shadow-2xl border border-amber-600/20 p-6">
          {activeTab === 'upload' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-amber-400">
                Nahrát Bible21 PDF
              </h2>
              <form onSubmit={handleUploadPDF} className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm text-slate-300">
                    Vyberte Bible21.pdf soubor:
                  </label>
                  <input
                    type="file"
                    name="pdf"
                    accept=".pdf"
                    required
                    className="block w-full text-sm text-slate-300
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-amber-600 file:text-white
                      hover:file:bg-amber-700
                      cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
                >
                  {loading ? 'Zpracovávám...' : 'Nahrát a zpracovat'}
                </button>
                <p className="text-sm text-slate-400 mt-2">
                  Proces vytvoří embeddingy pro všechny verše a uloží je do databáze.
                  Může trvat několik minut.
                </p>
              </form>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-amber-400">
                Systémový Prompt
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm text-slate-300">
                    Upravit prompt pro AI asistenta:
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    placeholder="Jsi biblický AI asistent..."
                    rows={10}
                    className="w-full bg-slate-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  onClick={handleUpdatePrompt}
                  disabled={loading || !systemPrompt.trim()}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
                >
                  {loading ? 'Ukládám...' : 'Uložit prompt'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'corrections' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-amber-400">
                Přehled korekcí
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Zobrazení všech korekcí provedených experty.
              </p>
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4 border border-amber-600/10">
                  <p className="text-sm text-slate-400">
                    Tato funkce bude implementována v další verzi.
                    Zobrazí seznam všech opravených odpovědí s možností exportu.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
