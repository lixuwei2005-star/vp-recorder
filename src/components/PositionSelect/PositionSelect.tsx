import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  Square,
} from 'lucide-react';

import {
  CameraPresetName,
  getPresetPosition,
  matchPreset,
  useCameraPosition,
} from 'contexts/cameraPosition';
import { useStreams } from 'contexts/streams';
import { CAMERA_HEIGHT, CAMERA_WIDTH } from 'services/composer';

import styles from './PositionSelect.module.css';

type PresetSpec = {
  name: CameraPresetName;
  label: string;
  Icon: typeof ArrowUpLeft;
};

const PRESETS: PresetSpec[] = [
  { name: 'tl', label: 'Top left', Icon: ArrowUpLeft },
  { name: 'tr', label: 'Top right', Icon: ArrowUpRight },
  { name: 'bl', label: 'Bottom left', Icon: ArrowDownLeft },
  { name: 'br', label: 'Bottom right', Icon: ArrowDownRight },
  { name: 'center', label: 'Center', Icon: Square },
];

const PositionSelect = () => {
  const { position, setPosition } = useCameraPosition();
  const { screenshareStream, cameraStream } = useStreams();

  if (!cameraStream) return null;

  // Use a sensible default screenshare aspect when no screenshare is active so
  // presets are still meaningful in the UI before sharing begins.
  const sizeFracX = CAMERA_WIDTH / 1920;
  const sizeFracY = CAMERA_HEIGHT / 1080;

  if (!screenshareStream) {
    // Camera-only layout: presets don't move the recorded camera, so hide.
    return null;
  }

  const active = matchPreset(position, sizeFracX, sizeFracY);

  return (
    <div className={styles.root}>
      {PRESETS.map(({ name, label, Icon }) => {
        const isActive = active === name;
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
  );
};

export default PositionSelect;
