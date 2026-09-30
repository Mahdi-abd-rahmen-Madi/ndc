import React from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';
import { RequestFormData } from './types';
import { styles } from './styles/HeightRequestModal.styles';

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
    <div className={styles.overlay}>
      <div className={styles.modalContainer}>
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>
            <AlertTriangle className={styles.headerIcon} />
            Demande de Calcul Technique
          </h3>
          <button 
            onClick={() => setShowHeightRequestForm(false)}
            className={styles.closeButton}
          >
            <X className={styles.closeIcon} />
          </button>
        </div>
        
        <form onSubmit={onSubmitRequest} className={styles.form}>
          <div className={styles.alertBox}>
            <p className={styles.alertText}>
              La hauteur sélectionnée ({selectedBuildingHeight}m bâtiment + {selectedHeight}m mât) nécessite une étude personnalisée par notre bureau d'études. Veuillez remplir ce formulaire pour initier la demande.
            </p>
          </div>
          
          <div className={styles.fieldsContainer}>
            <div className={styles.gridContainer}>
              <div>
                <label className={styles.label}>Nom complet</label>
                <input 
                  type="text" 
                  required
                  value={requestFormData.name}
                  onChange={e => setRequestFormData({...requestFormData, name: e.target.value})}
                  className={styles.input}
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className={styles.label}>Téléphone</label>
                <input 
                  type="tel" 
                  required
                  value={requestFormData.phone}
                  onChange={e => setRequestFormData({...requestFormData, phone: e.target.value})}
                  className={styles.input}
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>
            
            <div>
              <label className={styles.label}>Email</label>
              <input 
                type="email" 
                required
                value={requestFormData.email}
                onChange={e => setRequestFormData({...requestFormData, email: e.target.value})}
                className={styles.input}
                placeholder="jean.dupont@entreprise.fr"
              />
            </div>
            
            <div>
              <label className={styles.label}>Description détaillée du projet</label>
              <textarea 
                required
                rows={4}
                value={requestFormData.description}
                onChange={e => setRequestFormData({...requestFormData, description: e.target.value})}
                className={styles.textarea}
                placeholder="Précisez les contraintes spécifiques, la date de déploiement souhaitée..."
              ></textarea>
            </div>
          </div>
          
          <div className={styles.footer}>
            <button 
              type="button"
              onClick={() => setShowHeightRequestForm(false)}
              className={styles.cancelButton}
            >
              Annuler
            </button>
            <button 
              type="submit"
              disabled={isSubmittingRequest}
              className={styles.submitButton}
            >
              {isSubmittingRequest ? (
                <>
                  <svg className={styles.spinnerIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Envoi...
                </>
              ) : (
                <>
                  <Send className={styles.sendIcon} />
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
