import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Circle, RectangleHorizontal, Square } from 'lucide-react';

import { CameraShape, useCameraShape } from 'contexts/cameraShape';

import styles from './ShapeSelect.module.css';

type ShapeSpec = {
  value: CameraShape;
  label: string;
  Icon: typeof RectangleHorizontal;
};

const SHAPES: ShapeSpec[] = [
  { value: 'rectangle', label: 'Rectangle', Icon: RectangleHorizontal },
  { value: 'square', label: 'Square', Icon: Square },
  { value: 'circle', label: 'Circle', Icon: Circle },
];

const ShapeSelect = () => {
  const { shape, setShape } = useCameraShape();

  return (
    <div className={styles.root}>
      {SHAPES.map(({ value, label, Icon }) => {
        const isActive = shape === value;
        return (
          <Tooltip key={value} title={label}>
            <IconButton
              size="small"
              color={isActive ? 'primary' : 'default'}
              className={isActive ? styles.activeButton : undefined}
              onClick={() => setShape(value)}
              aria-label={label}
              aria-pressed={isActive}
            >
              <Icon size={18} />
            </IconButton>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default ShapeSelect;
