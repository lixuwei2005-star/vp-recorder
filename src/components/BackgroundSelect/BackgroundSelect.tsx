import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import cx from 'classnames';
import { ImageIcon, Upload, X } from 'lucide-react';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useI18n } from 'contexts/i18n';
import { useStreams } from 'contexts/streams';
import { useVirtualBackground } from 'contexts/virtualBackground';
import type { GradientSpec } from 'services/virtualBackground';

import { COLOR_PRESETS, GRADIENT_PRESETS } from './presets';

import styles from './BackgroundSelect.module.css';

// Cap uploads at a reasonable size. The image is stored as a base64 dataURL
// in localStorage, which has a hard quota in most browsers (~5–10 MB total).
// 4 MB of raw image yields ~5.4 MB of base64 — safely under the typical cap
// for a single key, with room for other localStorage entries.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const drawGradientToCanvas = (
  canvas: HTMLCanvasElement,
  spec: GradientSpec,
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  let grad: CanvasGradient;
  if (spec.type === 'radial') {
    grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  } else {
    const angle = ((spec.angle ?? 0) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const half = Math.max(w, h) / 2;
    grad = ctx.createLinearGradient(
      w / 2 - dx * half,
      h / 2 - dy * half,
      w / 2 + dx * half,
      h / 2 + dy * half,
    );
  }
  for (const stop of spec.stops) grad.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
};

const GradientThumb = ({ spec }: { spec: GradientSpec }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) drawGradientToCanvas(ref.current, spec);
  }, [spec]);
  return <canvas ref={ref} width={64} height={40} />;
};

const ColorThumb = ({ color }: { color: string }) => (
  <div className={styles.thumbFill} style={{ background: color }} />
);

type ThumbProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
};

const Thumb = ({ active, label, onClick, className, children }: ThumbProps) => (
  <Tooltip title={label}>
    <button
      type="button"
      className={cx(styles.thumb, className, {
        [styles.thumbActive]: active,
      })}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
    >
      {children}
      <span className={styles.thumbLabel}>{label}</span>
    </button>
  </Tooltip>
);

const BackgroundSelect = () => {
  const { cameraStream } = useStreams();
  const {
    option,
    setOption,
    uploadedImage,
    setUploadedImage,
    loadError,
    setLoadError,
  } = useVirtualBackground();
  const { t } = useI18n();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const open = (event: React.MouseEvent<HTMLElement>) => {
    setUploadError(null);
    setLoadError(null);
    setAnchorEl(event.currentTarget);
  };
  const close = () => setAnchorEl(null);

  const isActive = option.kind !== 'none';

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset so re-uploading the same file fires onChange again.
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setUploadError(t('bg.errChooseImage'));
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError(t('bg.errTooLarge'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : null;
        if (!dataUrl) {
          setUploadError(t('bg.errReadFailed'));
          return;
        }
        setUploadedImage(dataUrl);
        setOption({ kind: 'image', id: 'user-upload', imageDataUrl: dataUrl });
        setUploadError(null);
      };
      reader.onerror = () => setUploadError(t('bg.errReadFailed'));
      reader.readAsDataURL(file);
    },
    [setOption, setUploadedImage, t],
  );

  const removeUpload = useCallback(() => {
    setUploadedImage(null);
    if (option.kind === 'image') setOption({ kind: 'none' });
  }, [option.kind, setOption, setUploadedImage]);

  if (!cameraStream) return null;

  return (
    <>
      <Tooltip title={t('bg.virtualBackground')}>
        <button
          type="button"
          className={cx(styles.trigger, { [styles.triggerActive]: isActive })}
          onClick={open}
          aria-haspopup="dialog"
          aria-pressed={isActive}
        >
          <ImageIcon size={16} />
          <span>{t('bg.title')}</span>
        </button>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { className: styles.popover } }}
      >
        <div className={styles.grid}>
          <Thumb
            active={option.kind === 'none'}
            label={t('bg.none')}
            onClick={() => {
              setOption({ kind: 'none' });
              close();
            }}
            className={styles.thumbNone}
          >
            <span />
          </Thumb>
          <Thumb
            active={option.kind === 'blur'}
            label={t('bg.blur')}
            onClick={() => {
              setOption({ kind: 'blur' });
              close();
            }}
          >
            <div className={styles.thumbBlur} />
          </Thumb>
          {GRADIENT_PRESETS.map((preset) => (
            <Thumb
              key={preset.id}
              active={option.kind === 'gradient' && option.id === preset.id}
              label={t(preset.labelKey)}
              onClick={() => {
                setOption({
                  kind: 'gradient',
                  id: preset.id,
                  gradient: preset.gradient,
                });
                close();
              }}
            >
              <GradientThumb spec={preset.gradient} />
            </Thumb>
          ))}
          {COLOR_PRESETS.map((preset) => (
            <Thumb
              key={preset.id}
              active={option.kind === 'color' && option.id === preset.id}
              label={t(preset.labelKey)}
              onClick={() => {
                setOption({
                  kind: 'color',
                  id: preset.id,
                  color: preset.color,
                });
                close();
              }}
            >
              <ColorThumb color={preset.color} />
            </Thumb>
          ))}
          {uploadedImage && (
            <Thumb
              active={option.kind === 'image'}
              label={t('bg.custom')}
              onClick={() => {
                setOption({
                  kind: 'image',
                  id: 'user-upload',
                  imageDataUrl: uploadedImage,
                });
                close();
              }}
            >
              <img src={uploadedImage} alt={t('bg.altCustom')} />
              <span
                role="button"
                aria-label={t('bg.removeUpload')}
                tabIndex={0}
                className={styles.removeUpload}
                onClick={(event) => {
                  event.stopPropagation();
                  removeUpload();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.stopPropagation();
                    removeUpload();
                  }
                }}
              >
                <X size={12} />
              </span>
            </Thumb>
          )}
          <Thumb
            active={false}
            label={t('bg.upload')}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={styles.thumbIcon}>
              <Upload size={20} />
            </div>
          </Thumb>
        </div>
        {(uploadError || loadError) && (
          <div className={styles.section}>
            <span className={styles.sectionLabel} style={{ color: 'rgb(255 180 80)' }}>
              {uploadError ?? loadError}
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.uploadInput}
          onChange={handleFileChange}
        />
      </Popover>
    </>
  );
};

export default BackgroundSelect;
