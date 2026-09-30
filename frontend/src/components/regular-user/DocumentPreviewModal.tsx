import { X, ExternalLink, RefreshCw } from 'lucide-react';
import { PreviewDocState } from './types';
import { styles } from './styles/DocumentPreviewModal.styles';

interface DocumentPreviewModalProps {
  previewDoc: PreviewDocState | null;
  setPreviewDoc: (val: PreviewDocState | null) => void;
}

export default function DocumentPreviewModal({
  previewDoc,
  setPreviewDoc
}: DocumentPreviewModalProps) {
  if (!previewDoc) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>{previewDoc.filename}</h3>
          {!previewDoc.isConverting && !previewDoc.conversionFailed && (
            <a 
              href={previewDoc.originalUrl || previewDoc.url} 
              target="_blank" 
              rel="noreferrer"
              className={styles.externalLink}
            >
              <ExternalLink className={styles.externalLinkIcon} /> Ouvrir dans un nouvel onglet
            </a>
          )}
        </div>
        <button 
          onClick={() => setPreviewDoc(null)}
          className={styles.closeButton}
        >
          <X className={styles.closeIcon} />
        </button>
      </div>
      
      <div className={styles.contentContainer}>
        {previewDoc.isConverting ? (
          <div className={styles.stateContainer}>
            <RefreshCw className={styles.spinnerIcon} />
            <p className={styles.stateTitle}>Préparation du document...</p>
            <p className={styles.stateSubtitle}>Conversion en cours pour un affichage optimal</p>
          </div>
        ) : previewDoc.conversionFailed ? (
          <div className={styles.stateContainer}>
            <div className={styles.errorIconBox}>
              <X className={styles.errorIcon} />
            </div>
            <p className={styles.stateTitle}>Impossible d'afficher l'aperçu</p>
            <p className={styles.errorDescription}>
              Le format de ce document ne permet pas un aperçu direct dans le navigateur.
            </p>
            <a 
              href={previewDoc.originalUrl || previewDoc.url} 
              target="_blank" 
              rel="noreferrer"
              className={styles.downloadLink}
            >
              <ExternalLink className={styles.downloadIcon} /> Télécharger / Ouvrir le fichier original
            </a>
          </div>
        ) : (
          <iframe 
            src={previewDoc.url}
            className={styles.iframe}
            title="Aperçu Document"
          />
        )}
      </div>
    </div>
  );
}
