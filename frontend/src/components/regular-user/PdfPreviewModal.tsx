import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import { styles } from './styles/PdfPreviewModal.styles';

interface PdfPreviewModalProps {
  previewPdfUrl: string | null;
  conversionError: boolean;
  onClose: () => void;
}

export default function PdfPreviewModal({ previewPdfUrl, conversionError, onClose }: PdfPreviewModalProps) {
  if (!previewPdfUrl || conversionError) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modalContainer}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBox}>
              <FileText className={styles.icon} />
            </div>
            <div>
              <h3 className={styles.title}>Aperçu du document</h3>
              <p className={styles.subtitle}>Visionneuse PDF intégrée</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            title="Fermer l'aperçu"
          >
            ✕
          </button>
        </div>
        <div className={styles.content}>
          <iframe
            src={`${previewPdfUrl}#view=FitH`}
            className={styles.iframe}
            title="Document Preview"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
