import VideocamOffIcon from '@mui/icons-material/VideocamOffOutlined';
import VideocamIcon from '@mui/icons-material/VideocamOutlined';
import MenuItem from '@mui/material/MenuItem';

import DeviceSelect from 'components/DeviceSelect';
import { useI18n } from 'contexts/i18n';
import { useMediaDevices } from 'contexts/mediaDevices';

const CameraSelect = () => {
  const {
    cameras,
    cameraId,
    cameraEnabled,
    setPreferredCamera,
    setCameraEnabled,
  } = useMediaDevices();
  const { t } = useI18n();

  return (
    <DeviceSelect
      startAdornment={
        cameras.length && cameraEnabled ? (
          <VideocamIcon onClick={() => setCameraEnabled(false)} />
        ) : (
          <VideocamOffIcon
            onClick={() => cameras.length && setCameraEnabled(true)}
          />
        )
      }
      value={cameraId}
      onChange={(event) => setPreferredCamera(event.target.value)}
    >
      {cameras.length ? (
        cameras.map((camera) => (
          <MenuItem key={camera.deviceId} value={camera.deviceId}>
            {camera.label}
          </MenuItem>
        ))
      ) : (
        <MenuItem disabled value="">
          {t('device.noCameras')}
        </MenuItem>
      )}
    </DeviceSelect>
  );
};

export default CameraSelect;
