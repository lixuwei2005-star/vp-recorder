import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Github,
  Keyboard,
  Layers,
  Lock,
  ScanFace,
  ScrollText,
  Sparkles,
  Video,
} from 'lucide-react';
import { useState } from 'react';

import LanguageSwitcher from 'components/LanguageSwitcher';
import { useI18n } from 'contexts/i18n';
import { enterApp } from 'services/landingRoute';

import styles from './Landing.module.css';

const GITHUB_URL = 'https://github.com/lixuwei2005-star/vp-recorder';

const FEATURE_ICONS = [Layers, ScanFace, Sparkles, ScrollText, Lock, Video];
const FEATURE_KEYS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] as const;
const STEP_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const;
const SHORTCUT_KEYS = [
  'shiftNum',
  'shiftSize',
  'ctrl0',
  'e',
  'd',
  'space',
  'pageUpDown',
  'bracket',
  'home',
] as const;
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

const Landing = () => {
  const { t } = useI18n();
  const [openFaq, setOpenFaq] = useState<string | null>('q1');

  const handleStart = () => {
    enterApp();
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgGlow} />

      <nav className={styles.nav}>
        <div className={styles.brand}>
          <img src="/logo.svg" alt="" className={styles.brandLogo} />
          <span>{t('landing.brand')}</span>
        </div>
        <div className={styles.navRight}>
          <a
            className={styles.navLink}
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('landing.nav.github')}
          </a>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Hero */}
      <section className={`${styles.section} ${styles.hero}`}>
        <motion.h1
          className={styles.heroTitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {t('landing.hero.title')}
        </motion.h1>
        <motion.p
          className={styles.heroSubtitle}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {t('landing.hero.subtitle')}
        </motion.p>
        <motion.div
          className={styles.heroCtaRow}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleStart}
          >
            {t('landing.hero.cta.primary')}
            <ArrowRight size={18} />
          </button>
          <a
            className={styles.btnSecondary}
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={18} />
            {t('landing.hero.cta.secondary')}
          </a>
        </motion.div>
        <motion.p
          className={styles.heroTrust}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          {t('landing.hero.trust')}
        </motion.p>

        <motion.div
          className={styles.heroPreview}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          <img src="/screenshot-01.jpg" alt="vp-recorder preview" />
        </motion.div>
      </section>

      {/* Features */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('landing.features.title')}</h2>
        <div className={styles.featuresGrid}>
          {FEATURE_KEYS.map((key, idx) => {
            const Icon = FEATURE_ICONS[idx];
            return (
              <motion.div
                key={key}
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <div className={styles.featureIcon}>
                  <Icon size={22} />
                </div>
                <h3 className={styles.featureTitle}>
                  {t(`landing.features.${key}.title`)}
                </h3>
                <p className={styles.featureBody}>
                  {t(`landing.features.${key}.body`)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Steps */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('landing.steps.title')}</h2>
        <div className={styles.stepsList}>
          {STEP_KEYS.map((key, idx) => (
            <motion.div
              key={key}
              className={styles.stepCard}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.35, delay: idx * 0.04 }}
            >
              <div className={styles.stepNum}>{idx + 1}</div>
              <div className={styles.stepBody}>
                <h3 className={styles.stepTitle}>
                  {t(`landing.steps.${key}.title`)}
                </h3>
                <p className={styles.stepText}>
                  {t(`landing.steps.${key}.body`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Shortcuts */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Keyboard
            size={28}
            style={{ verticalAlign: '-6px', marginRight: 12 }}
          />
          {t('landing.shortcuts.title')}
        </h2>
        <table className={styles.shortcutsTable}>
          <tbody>
            {SHORTCUT_KEYS.map((key) => (
              <tr key={key}>
                <td>
                  <span className={styles.kbd}>
                    {t(`landing.shortcuts.key.${key}`)}
                  </span>
                </td>
                <td>{t(`landing.shortcuts.desc.${key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('landing.faq.title')}</h2>
        <div className={styles.faqList}>
          {FAQ_KEYS.map((key) => {
            const isOpen = openFaq === key;
            return (
              <div key={key} className={styles.faqItem}>
                <button
                  type="button"
                  className={styles.faqQuestion}
                  onClick={() => setOpenFaq(isOpen ? null : key)}
                  aria-expanded={isOpen}
                >
                  <span>{t(`landing.faq.${key}`)}</span>
                  <ChevronDown
                    size={20}
                    className={`${styles.faqChevron} ${
                      isOpen ? styles.faqChevronOpen : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className={styles.faqAnswer}>
                    {t(`landing.faq.${key.replace('q', 'a')}`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className={styles.ctaBand}>
        <h2 className={styles.ctaBandTitle}>{t('landing.cta.bottom.title')}</h2>
        <p className={styles.ctaBandBody}>{t('landing.cta.bottom.body')}</p>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleStart}
        >
          {t('landing.hero.cta.primary')}
          <ArrowRight size={18} />
        </button>
      </section>

      <footer className={styles.pageFooter}>
        <div>{t('landing.footer.credits')}</div>
        <div style={{ marginTop: 8 }}>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            {t('landing.footer.viewSource')}
          </a>
          <span className={styles.pageFooterDot}>·</span>
          <span>{t('landing.footer.license')}</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
