import Button from '@mui/material/Button';

import { useI18n } from 'contexts/i18n';

import styles from './RecordingModal.module.css';

type RecordingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  recordingBlob: Blob | null;
};

export const RecordingModal = ({
  isOpen,
  onClose,
  recordingBlob,
}: RecordingModalProps) => {
  const { t } = useI18n();

  if (!isOpen || !recordingBlob) return null;

  const downloadWebm = () => {
    const url = URL.createObjectURL(recordingBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recording.webm';
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'black',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          {t('modal.recordingComplete')}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('modal.cancel')}</Button>
          <Button onClick={downloadWebm} className={styles.downloadButton}>
            {t('modal.downloadWebm')}
          </Button>
        </div>
      </div>
    </div>
  );
};
