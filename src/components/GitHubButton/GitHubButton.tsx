import GitHubIcon from '@mui/icons-material/GitHub';
import Button from '@mui/material/Button';

import { useI18n } from 'contexts/i18n';

import styles from './GitHubButton.module.css';

const GitHubButton = () => {
  const { t } = useI18n();
  return (
    <Button
      className={styles.root}
      href="https://github.com/contrastio/recorder"
      target="_blank"
      startIcon={<GitHubIcon />}
    >
      {t('github.starOnGitHub')}
    </Button>
  );
};

export default GitHubButton;
