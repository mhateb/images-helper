import { useState, type MouseEvent } from 'react';
import { getConsent, setConsent, type ConsentStatus } from '../analytics/consent';
import styles from './ConsentBanner.module.css';

type ConsentBannerProps = {
  onConsentChange: (status: ConsentStatus) => void;
  onOpenPrivacy: () => void;
};

export function ConsentBanner({ onConsentChange, onOpenPrivacy }: ConsentBannerProps) {
  const [visible, setVisible] = useState(() => getConsent() === null);
  if (!visible) return null;

  const choose = (status: ConsentStatus) => {
    setConsent(status);
    setVisible(false);
    onConsentChange(status);
  };

  const onPrivacyClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onOpenPrivacy();
  };

  return (
    <div className={styles.banner} role="dialog" aria-label="Согласие на cookies">
      <p className={styles.text}>
        Мы используем Яндекс.Метрику, чтобы понимать, как работает Fitpix. Подробнее — в{' '}
        <a href="/privacy" className={styles.link} onClick={onPrivacyClick}>
          политике конфиденциальности
        </a>
        .
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => choose('denied')}>
          Только необходимые
        </button>
        <button type="button" className={styles.primary} onClick={() => choose('granted')}>
          Принимаю
        </button>
      </div>
    </div>
  );
}
