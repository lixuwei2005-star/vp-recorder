import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import cx from 'classnames';
import { RotateCcw, ScanFace } from 'lucide-react';

import {
  FRAMING_OFFSET_MAX,
  FRAMING_OFFSET_MIN,
  FRAMING_ZOOM_MAX,
  FRAMING_ZOOM_MIN,
  useCameraFraming,
} from 'contexts/cameraFraming';
import { useI18n } from 'contexts/i18n';
import { useStreams } from 'contexts/streams';

import styles from './FramingSelect.module.css';

const OFFSET_MARKS = [{ value: 0 }];

const FramingSelect = () => {
  const {
    framing,
    setFraming,
    resetFraming,
    framingMode,
    setFramingMode,
    faceTrackingStatus,
  } = useCameraFraming();
  const { cameraStream } = useStreams();
  const { t } = useI18n();

  if (!cameraStream) return null;

  const isAuto = framingMode === 'auto';

  // Status label shown only while auto mode is on. 'idle' is invisible in
  // auto mode because that's the transient pre-load state.
  let statusLabel: string | null = null;
  if (isAuto) {
    switch (faceTrackingStatus) {
      case 'loading':
        statusLabel = t('framing.statusLoading');
        break;
      case 'tracking':
        statusLabel = t('framing.statusTracking');
        break;
      case 'no-face':
        statusLabel = t('framing.statusNoFace');
        break;
      case 'error':
        statusLabel = t('framing.statusError');
        break;
      default:
        statusLabel = t('framing.statusTracking');
    }
  }

  return (
    <div className={styles.wrapper}>
      <Tooltip title={t('framing.cameraZoom')} placement="top">
        <div className={styles.group}>
          <span className={styles.label}>{framing.zoom.toFixed(2)}x</span>
          <Slider
            className={styles.slider}
            size="small"
            value={framing.zoom}
            min={FRAMING_ZOOM_MIN}
            max={FRAMING_ZOOM_MAX}
            step={0.05}
            disabled={isAuto}
            onChange={(_event, value) => {
              if (typeof value === 'number') setFraming({ zoom: value });
            }}
            aria-label={t('framing.cameraZoom')}
          />
        </div>
      </Tooltip>
      <Tooltip title={t('framing.horizontalPan')} placement="top">
        <div className={styles.group}>
          <span className={styles.axisLabel}>H</span>
          <Slider
            className={styles.slider}
            size="small"
            value={framing.offsetX}
            min={FRAMING_OFFSET_MIN}
            max={FRAMING_OFFSET_MAX}
            step={0.02}
            marks={OFFSET_MARKS}
            disabled={isAuto}
            onChange={(_event, value) => {
              if (typeof value === 'number') setFraming({ offsetX: value });
            }}
            aria-label={t('framing.ariaHorizontal')}
          />
        </div>
      </Tooltip>
      <Tooltip title={t('framing.verticalPan')} placement="top">
        <div className={styles.group}>
          <span className={styles.axisLabel}>V</span>
          <Slider
            className={styles.slider}
            size="small"
            value={framing.offsetY}
            min={FRAMING_OFFSET_MIN}
            max={FRAMING_OFFSET_MAX}
            step={0.02}
            marks={OFFSET_MARKS}
            disabled={isAuto}
            onChange={(_event, value) => {
              if (typeof value === 'number') setFraming({ offsetY: value });
            }}
            aria-label={t('framing.ariaVertical')}
          />
        </div>
      </Tooltip>
      <Tooltip title={t('framing.reset')} placement="top">
        <IconButton
          size="small"
          onClick={resetFraming}
          aria-label={t('framing.reset')}
          disabled={isAuto}
        >
          <RotateCcw size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip title={isAuto ? t('framing.autoOn') : t('framing.autoOff')} placement="top">
        <IconButton
          size="small"
          color={isAuto ? 'primary' : 'default'}
          className={isAuto ? styles.autoActive : undefined}
          onClick={() => setFramingMode(isAuto ? 'manual' : 'auto')}
          aria-label={t('framing.ariaAutoToggle')}
          aria-pressed={isAuto}
        >
          <ScanFace size={16} />
        </IconButton>
      </Tooltip>
      {statusLabel && (
        <span
          className={cx(styles.autoHint, {
            [styles.warning]:
              faceTrackingStatus === 'no-face' ||
              faceTrackingStatus === 'error',
          })}
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
};

export default FramingSelect;
