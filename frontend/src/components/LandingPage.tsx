import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Shield, FileText, LogOut, User as UserIcon } from 'lucide-react';

interface LandingPageProps {
  token: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function LandingPage({ token, userEmail, isAdmin, onLogout }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
      
      {/* Dynamic gradient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none"></div>

      {/* Header / Navbar */}
      <header className="h-20 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 md:px-12 flex items-center justify-between shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-wide">
            NDC <span className="font-light">Structure</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {token && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm font-medium text-slate-300 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                <UserIcon className="w-4 h-4 text-indigo-400" />
                {userEmail}
              </span>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Déconnexion</span>
              </button>
            </div>
          )}
          {token && isAdmin && (
            <Link
              to="/engineer"
              className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl transition-all font-medium"
            >
              Espace Ingénieur
            </Link>
          )}
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-20 z-10 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-4xl mx-auto mb-16 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 mb-2 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Plateforme Eurocode & Struct
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
            <span className="block text-white">Catalogue de Conception</span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 mt-2">
              d'Antennes
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Trouvez les profils de mât requis et les documents de calcul technique en quelques clics grâce à notre outil de classification environnementale.
          </p>

          {/* CTA Buttons */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/portal"
              className="group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-xl shadow-indigo-900/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 overflow-hidden w-full sm:w-auto justify-center"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <span>{token ? 'Accéder au Portail Client NDC' : 'Se connecter / S\'inscrire'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
          <div className="bg-slate-900/40 border border-slate-800/80 hover:border-indigo-500/30 rounded-2xl p-6 transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Recherche Géo-spatiale</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Déterminez précisément la région de vent et la rugosité de terrain de votre site grâce à l'analyse cartographique.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 hover:border-purple-500/30 rounded-2xl p-6 transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Conformité Eurocode 3</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Accédez aux profils de mât précalculés et validés par nos ingénieurs selon les exigences réglementaires.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 hover:border-emerald-500/30 rounded-2xl p-6 transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Notes de Calcul & Fiches</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Visualisez et téléchargez les fiches de synthèse technique et les documents d'exécution au format PDF.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-6 md:px-12 text-center text-xs text-slate-500 z-10">
        <p>© {new Date().getFullYear()} NDC Structure. Tous droits réservés. Conçu pour le dimensionnement d'infrastructures télécoms.</p>
      </footer>

      {/* Inline styles for shimmer effect */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
