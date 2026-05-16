import MicIcon from '@mui/icons-material/MicNone';
import MicOffIcon from '@mui/icons-material/MicOffOutlined';
import MenuItem from '@mui/material/MenuItem';

import DeviceSelect from 'components/DeviceSelect';
import { useI18n } from 'contexts/i18n';
import { useMediaDevices } from 'contexts/mediaDevices';

const MicrophoneSelect = () => {
  const {
    microphones,
    microphoneId,
    microphoneEnabled,
    setPreferredMicrophone,
    setMicrophoneEnabled,
  } = useMediaDevices();
  const { t } = useI18n();

  return (
    <DeviceSelect
      startAdornment={
        microphones.length && microphoneEnabled ? (
          <MicIcon onClick={() => setMicrophoneEnabled(false)} />
        ) : (
          <MicOffIcon onClick={() => setMicrophoneEnabled(true)} />
        )
      }
      value={microphoneId}
      onChange={(event) => setPreferredMicrophone(event.target.value)}
    >
      {microphones.length ? (
        microphones.map((microphone) => (
          <MenuItem key={microphone.deviceId} value={microphone.deviceId}>
            {microphone.label}
          </MenuItem>
        ))
      ) : (
        <MenuItem disabled value="">
          {t('device.noMicrophones')}
        </MenuItem>
      )}
    </DeviceSelect>
  );
};

export default MicrophoneSelect;
