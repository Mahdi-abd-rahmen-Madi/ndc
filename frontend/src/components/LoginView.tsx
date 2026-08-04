import { useState } from 'react';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
  apiBaseUrl: string;
}

export default function LoginView({ onLoginSuccess, apiBaseUrl }: LoginViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isLogin ? '/api/auth/login/' : '/api/auth/register/';
    
    try {
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        onLoginSuccess(data.token, data.email, !!data.is_admin);
      } else {
        setError(data.error || 'Une erreur est survenue.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
      
      <div className="w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">NDC Portail</h2>
          <p className="text-slate-400">
            {isLogin ? 'Connectez-vous pour accéder à vos notes de calcul' : 'Créez un compte pour sauvegarder vos notes de calcul'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Mot de passe</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isLogin ? 'Se connecter' : 'S\'inscrire'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
