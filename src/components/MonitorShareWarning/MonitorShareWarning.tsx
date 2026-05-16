import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useEffect, useRef, useState } from 'react';

import { useI18n } from 'contexts/i18n';
import { useScreenshare } from 'contexts/screenshare';
import { useStreams } from 'contexts/streams';
import { useTeleprompter } from 'contexts/teleprompter';

/**
 * When the user is sharing the entire monitor AND the teleprompter is on,
 * the teleprompter overlay (or its Document PiP window) will be captured —
 * there is no web API that excludes a region of the page from screen
 * capture. Surface a Snackbar telling the user, with a one-click affordance
 * to reopen the picker (handled via the existing switchScreenshare flow).
 *
 * Dismissal is per-stream: dismissing for one source resets when the user
 * picks a different one or toggles the teleprompter off and on again.
 */
const MonitorShareWarning = () => {
  const { screenshareStream } = useStreams();
  const { switchScreenshare } = useScreenshare();
  const { enabled: teleprompterEnabled } = useTeleprompter();
  const { t } = useI18n();

  const [displaySurface, setDisplaySurface] = useState<string | null>(null);
  // displaySurface lives on MediaTrackSettings under a property the lib.dom
  // typings don't always include. Read defensively.
  useEffect(() => {
    if (!screenshareStream) {
      setDisplaySurface(null);
      return;
    }
    const track = screenshareStream.getVideoTracks()[0];
    if (!track) {
      setDisplaySurface(null);
      return;
    }
    const settings = track.getSettings() as MediaTrackSettings & {
      displaySurface?: string;
    };
    setDisplaySurface(settings.displaySurface ?? null);
  }, [screenshareStream]);

  // Reset dismissal whenever the watched conditions transition — picking a
  // new source, or toggling the teleprompter off/on, gives the warning a
  // fresh chance to surface.
  const [dismissed, setDismissed] = useState(false);
  const lastStreamRef = useRef<MediaStream | null>(null);
  const lastTeleprompterRef = useRef(teleprompterEnabled);
  useEffect(() => {
    if (
      lastStreamRef.current !== screenshareStream ||
      lastTeleprompterRef.current !== teleprompterEnabled
    ) {
      lastStreamRef.current = screenshareStream;
      lastTeleprompterRef.current = teleprompterEnabled;
      setDismissed(false);
    }
  }, [screenshareStream, teleprompterEnabled]);

  const shouldShow =
    !!screenshareStream &&
    displaySurface === 'monitor' &&
    teleprompterEnabled &&
    !dismissed;

  return (
    <Snackbar
      open={shouldShow}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="warning"
        variant="filled"
        onClose={() => setDismissed(true)}
        action={
          <>
            <Button
              size="small"
              color="inherit"
              onClick={() => {
                setDismissed(true);
                void switchScreenshare();
              }}
            >
              {t('screenshare.switchSource')}
            </Button>
          </>
        }
        sx={{ maxWidth: 560 }}
      >
        {t('screenshare.monitorWarning')}
      </Alert>
    </Snackbar>
  );
};

export default MonitorShareWarning;
