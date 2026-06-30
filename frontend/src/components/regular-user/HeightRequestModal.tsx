import React from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';
import { RequestFormData } from './types';

interface HeightRequestModalProps {
  showHeightRequestForm: boolean;
  setShowHeightRequestForm: (val: boolean) => void;
  requestFormData: RequestFormData;
  setRequestFormData: (val: RequestFormData) => void;
  isSubmittingRequest: boolean;
  onSubmitRequest: (e: React.FormEvent) => void;
  selectedBuildingHeight: number;
  selectedHeight: number;
}

export default function HeightRequestModal({
  showHeightRequestForm,
  setShowHeightRequestForm,
  requestFormData,
  setRequestFormData,
  isSubmittingRequest,
  onSubmitRequest,
  selectedBuildingHeight,
  selectedHeight
}: HeightRequestModalProps) {
  if (!showHeightRequestForm) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Demande de Calcul Technique
          </h3>
          <button 
            onClick={() => setShowHeightRequestForm(false)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={onSubmitRequest} className="p-6">
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-200/80">
              La hauteur sélectionnée ({selectedBuildingHeight}m bâtiment + {selectedHeight}m mât) nécessite une étude personnalisée par notre bureau d'études. Veuillez remplir ce formulaire pour initier la demande.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nom complet</label>
                <input 
                  type="text" 
                  required
                  value={requestFormData.name}
                  onChange={e => setRequestFormData({...requestFormData, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Téléphone</label>
                <input 
                  type="tel" 
                  required
                  value={requestFormData.phone}
                  onChange={e => setRequestFormData({...requestFormData, phone: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input 
                type="email" 
                required
                value={requestFormData.email}
                onChange={e => setRequestFormData({...requestFormData, email: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="jean.dupont@entreprise.fr"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description détaillée du projet</label>
              <textarea 
                required
                rows={4}
                value={requestFormData.description}
                onChange={e => setRequestFormData({...requestFormData, description: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                placeholder="Précisez les contraintes spécifiques, la date de déploiement souhaitée..."
              ></textarea>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => setShowHeightRequestForm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button 
              type="submit"
              disabled={isSubmittingRequest}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmittingRequest ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer la Demande
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
