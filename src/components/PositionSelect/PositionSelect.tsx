import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  Square,
} from 'lucide-react';

import {
  CAMERA_SIZE_MAX,
  CAMERA_SIZE_MIN,
  CameraPresetName,
  getPresetPosition,
  matchPreset,
  useCameraPosition,
} from 'contexts/cameraPosition';
import {
  getEffectiveCameraAspectRatio,
  useCameraShape,
} from 'contexts/cameraShape';
import { useI18n } from 'contexts/i18n';
import { useStreams } from 'contexts/streams';

import styles from './PositionSelect.module.css';

type PresetSpec = {
  name: CameraPresetName;
  labelKey: string;
  Icon: typeof ArrowUpLeft;
};

const PRESETS: PresetSpec[] = [
  { name: 'tl', labelKey: 'position.topLeft', Icon: ArrowUpLeft },
  { name: 'tr', labelKey: 'position.topRight', Icon: ArrowUpRight },
  { name: 'bl', labelKey: 'position.bottomLeft', Icon: ArrowDownLeft },
  { name: 'br', labelKey: 'position.bottomRight', Icon: ArrowDownRight },
  { name: 'center', labelKey: 'position.center', Icon: Square },
];

// Default screenshare aspect (16:9) used to derive sizeFracY for presets when
// no screenshare is active yet.
const DEFAULT_SCREENSHARE_ASPECT = 16 / 9;

const PositionSelect = () => {
  const { position, setPosition, size, setSize, cameraAspectRatio } =
    useCameraPosition();
  const { shape } = useCameraShape();
  const { screenshareStream, cameraStream } = useStreams();
  const { t } = useI18n();

  if (!cameraStream) return null;
  if (!screenshareStream) {
    // Camera-only layout: presets don't move the recorded camera, so hide.
    return null;
  }

  const effectiveAspect = getEffectiveCameraAspectRatio(
    shape,
    cameraAspectRatio,
  );
  const sizeFracX = size;
  const sizeFracY = (size * DEFAULT_SCREENSHARE_ASPECT) / effectiveAspect;

  const active = matchPreset(position, sizeFracX, sizeFracY);
  const cameraSizeLabel = t('position.cameraSize');

  return (
    <div className={styles.wrapper}>
      <div className={styles.root}>
        {PRESETS.map(({ name, labelKey, Icon }) => {
          const isActive = active === name;
          const label = t(labelKey);
          return (
            <Tooltip key={name} title={label}>
              <IconButton
                size="small"
                color={isActive ? 'primary' : 'default'}
                className={isActive ? styles.activeButton : undefined}
                onClick={() =>
                  setPosition(getPresetPosition(name, sizeFracX, sizeFracY))
                }
                aria-label={label}
              >
                <Icon size={18} />
              </IconButton>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip title={cameraSizeLabel}>
        <div className={styles.sizeGroup}>
          <span className={styles.sizeLabel}>{Math.round(size * 100)}%</span>
          <Slider
            className={styles.sizeSlider}
            size="small"
            value={size}
            min={CAMERA_SIZE_MIN}
            max={CAMERA_SIZE_MAX}
            step={0.01}
            onChange={(_event, value) => {
              if (typeof value === 'number') setSize(value);
            }}
            aria-label={cameraSizeLabel}
          />
        </div>
      </Tooltip>
    </div>
  );
};

export default PositionSelect;
