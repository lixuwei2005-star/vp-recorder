import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import chromeIcon from 'assets/chrome.svg';
import { useI18n } from 'contexts/i18n';

import styles from './BrowserNotSupported.module.css';

const BrowserNotSupported = () => {
  const { t } = useI18n();
  return (
    <div className={styles.root}>
      <Typography variant="h6">{t('browser.notSupportedTitle')}</Typography>
      <Typography variant="subtitle1">
        {t('browser.notSupportedBody')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        • Document Picture-in-Picture API
        <br />
        • MediaStreamTrack Processor API
        <br />• MediaStreamTrack Generator API
      </Typography>
      <Link
        className={styles.chromeLink}
        href="https://www.google.com/chrome/"
        target="_blank"
        color="secondary"
        underline="none"
      >
        <img className={styles.chromeIcon} src={chromeIcon} />
        {t('browser.openChrome')}
      </Link>
    </div>
  );
};

export default BrowserNotSupported;
