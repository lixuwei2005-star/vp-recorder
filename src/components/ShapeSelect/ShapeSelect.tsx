import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Circle, RectangleHorizontal, Square } from 'lucide-react';

import { CameraShape, useCameraShape } from 'contexts/cameraShape';
import { useI18n } from 'contexts/i18n';

import styles from './ShapeSelect.module.css';

type ShapeSpec = {
  value: CameraShape;
  labelKey: string;
  Icon: typeof RectangleHorizontal;
};

const SHAPES: ShapeSpec[] = [
  { value: 'rectangle', labelKey: 'shape.rectangle', Icon: RectangleHorizontal },
  { value: 'square', labelKey: 'shape.square', Icon: Square },
  { value: 'circle', labelKey: 'shape.circle', Icon: Circle },
];

const ShapeSelect = () => {
  const { shape, setShape } = useCameraShape();
  const { t } = useI18n();

  return (
    <div className={styles.root}>
      {SHAPES.map(({ value, labelKey, Icon }) => {
        const isActive = shape === value;
        const label = t(labelKey);
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
