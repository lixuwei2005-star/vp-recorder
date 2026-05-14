import CssBaseline from '@mui/material/CssBaseline';
import {
  Experimental_CssVarsProvider as CssVarsProvider,
  StyledEngineProvider,
} from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import BrowserNotSupported from 'components/BrowserNotSupported';
import Compose from 'components/Compose';
import { CountdownProvider } from 'contexts/countdown';
import { I18nProvider } from 'contexts/i18n';
import { LayoutProvider } from 'contexts/layout';
import { MediaDevicesProvider } from 'contexts/mediaDevices';
import { CameraFramingProvider } from 'contexts/cameraFraming';
import { CameraPositionProvider } from 'contexts/cameraPosition';
import { CameraShapeProvider } from 'contexts/cameraShape';
import { PictureInPictureProvider } from 'contexts/pictureInPicture';
import { RecordingProvider } from 'contexts/recording';
import { ScreenshareProvider } from 'contexts/screenshare';
import { StreamsProvider } from 'contexts/streams';
import { TeleprompterProvider } from 'contexts/teleprompter';
import { VirtualBackgroundProvider } from 'contexts/virtualBackground';

import App from './App';
import theme from './theme';

const isBrowserSupported =
  'documentPictureInPicture' in window &&
  'MediaStreamTrackProcessor' in window &&
  'MediaStreamTrackGenerator' in window;

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <CssBaseline />
        {isBrowserSupported ? (
          <Compose
            components={[
              I18nProvider,
              LayoutProvider,
              StreamsProvider,
              CameraPositionProvider,
              CameraShapeProvider,
              CameraFramingProvider,
              VirtualBackgroundProvider,
              RecordingProvider,
              PictureInPictureProvider,
              MediaDevicesProvider,
              ScreenshareProvider,
              CountdownProvider,
              TeleprompterProvider,
            ]}
          >
            <App />
          </Compose>
        ) : (
          <BrowserNotSupported />
        )}
      </CssVarsProvider>
    </StyledEngineProvider>
  </StrictMode>,
);
