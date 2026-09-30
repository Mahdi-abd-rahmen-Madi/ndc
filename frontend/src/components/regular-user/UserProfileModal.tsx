import React, { useState } from 'react';
import { User as UserIcon, Upload, X, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { styles } from './styles/UserProfileModal.styles';

interface UserProfileModalProps {
  onClose: () => void;
  clientLogoUrl: string | null;
  onClientLogoUploaded: (url: string | null) => void;
  apiBaseUrl: string;
}

export default function UserProfileModal({
  onClose,
  clientLogoUrl,
  onClientLogoUploaded,
  apiBaseUrl,
}: UserProfileModalProps) {
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError(null);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setLogoUploadError('Format invalide. Seuls JPG et PNG sont acceptés.');
      e.target.value = '';
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setLogoUploadError('Fichier trop volumineux (max 10MB).');
      e.target.value = '';
      return;
    }

    try {
      setIsLogoUploading(true);
      let fileToUpload = file;
      
      // Compress if larger than 1MB
      if (file.size > 1024 * 1024) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1024,
          useWebWorker: true
        };
        fileToUpload = await imageCompression(file, options);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const token = localStorage.getItem('ndc_auth_token');
      const res = await fetch(`${apiBaseUrl}/api/user-profiles/upload_logo/`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Token ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onClientLogoUploaded(data.client_logo);
      } else {
        const errText = await res.text();
        console.error('Logo upload failed:', errText);
        setLogoUploadError(`Erreur: ${res.status} ${errText.substring(0, 50)}`);
      }
    } catch (err) {
      console.error('Logo upload failed:', err);
      setLogoUploadError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsLogoUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalContainer}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>
            <UserIcon className={styles.headerIcon} />
            Profil Utilisateur
          </h2>
          <button 
            onClick={onClose}
            className={styles.closeButton}
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.contentBody}>
          <div className={styles.sectionContainer}>
            <label className={styles.label}>
              Photo de profil
            </label>
            <p className={styles.description}>
              Cette image sera utilisée comme logo du client sur tous les documents NDC générés.
            </p>

            {clientLogoUrl && (
              <div className={styles.logoPreviewContainer}>
                <button
                  type="button"
                  onClick={() => onClientLogoUploaded(null)}
                  className={styles.removeLogoButton}
                  title="Supprimer l'image"
                >
                  <X className={styles.removeLogoIcon} />
                </button>
                <img 
                  src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`} 
                  alt="Client Logo" 
                  className={styles.logoImage}
                />
              </div>
            )}

            <div className={styles.uploadContainer}>
              <input
                type="file"
                accept="image/jpeg, image/png"
                id="profile-logo-upload"
                className={styles.fileInput}
                onChange={handleLogoUpload}
                disabled={isLogoUploading}
              />
              <div className={`${styles.uploadBoxBase} ${logoUploadError ? styles.uploadBoxError : clientLogoUrl ? styles.uploadBoxSuccess : styles.uploadBoxDefault}`}>
                {isLogoUploading ? (
                  <>
                    <Loader2 className={styles.loadingIcon} />
                    <span className={styles.loadingText}>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <Upload className={`${styles.uploadIconBase} ${logoUploadError ? styles.uploadIconError : styles.uploadIconDefault}`} />
                    <span className={styles.uploadTitle}>
                      {clientLogoUrl ? 'Changer l\'image' : 'Sélectionner une image'}
                    </span>
                    <span className={styles.uploadSubtitle}>
                      JPG ou PNG (Max 10MB)
                    </span>
                  </>
                )}
              </div>
            </div>

            {logoUploadError && (
              <p className={styles.errorMessage}>
                {logoUploadError}
              </p>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            onClick={onClose}
            className={styles.footerButton}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
