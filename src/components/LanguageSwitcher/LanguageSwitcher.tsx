import cx from 'classnames';

import { Lang, useI18n } from 'contexts/i18n';

import styles from './LanguageSwitcher.module.css';

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'zh', label: '中' },
  { value: 'en', label: 'EN' },
];

const LanguageSwitcher = () => {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={styles.root} role="group" aria-label={t('lang.label')}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cx(styles.option, { [styles.active]: lang === opt.value })}
          aria-pressed={lang === opt.value}
          onClick={() => setLang(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
