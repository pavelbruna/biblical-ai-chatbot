'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Nesprávné přihlašovací údaje');
        setLoading(false);
        return;
      }

      router.push('/');
    } catch (error) {
      console.error('Login error:', error);
      setError('Chyba při přihlašování');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800/50 rounded-lg shadow-2xl border border-amber-600/20 p-8">
          <h1 className="text-3xl font-bold text-amber-400 text-center mb-8">
            Biblický AI Asistent
          </h1>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="admin@biblical-ai.local"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Heslo
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
            >
              {loading ? 'Přihlašování...' : 'Přihlásit se'}
            </button>
          </form>

          <p className="text-slate-400 text-sm text-center mt-6">
            Biblický AI chatbot s RAG systémem
          </p>
        </div>
      </div>
    </div>
  );
}
