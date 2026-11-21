import type { MouseEvent } from 'react';
import styles from './PrivacyPage.module.css';

type PrivacyPageProps = {
  onNavigate: (to: string) => void;
};

export function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  const go =
    (to: string) =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
      onNavigate(to);
    };

  return (
    <article className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Правовая информация</p>
        <h1>Политика конфиденциальности</h1>
        <p className={styles.lead}>
          Какие данные Fitpix.ru обрабатывает и зачем.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Обработка изображений</h2>
        <p>
          Загруженные файлы обрабатываются на сервере в оперативной памяти и не записываются на
          диск. Аккаунтов у нас нет, архив картинок мы не храним.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Яндекс.Метрика</h2>
        <p>
          Если вы нажали «Принимаю» в баннере, на сайте работает счётчик Яндекс.Метрики. Он
          показывает посещаемость, источники трафика и то, доходят ли пользователи до оптимизации
          и скачивания. Метрика может использовать cookies и похожие технологии.
        </p>
        <p>
          Чтобы отказаться, выберите «Только необходимые» в баннере. Если уже согласились,
          очистите данные сайта в браузере: счётчик больше не загрузится.
        </p>
        <p>
          Подробнее:{' '}
          <a
            href="https://yandex.ru/legal/metrica_termsofuse/"
            target="_blank"
            rel="noopener noreferrer"
          >
            условия использования Яндекс.Метрики
          </a>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2>Сообщения о проблемах</h2>
        <p>
          В сообщении о проблеме мы получаем описание, а также email и скриншот, если вы их
          приложили. Эти данные нужны, чтобы разобраться в проблеме и ответить. Не отправляйте в
          форме пароли и другие секреты.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Контакты</h2>
        <p>
          Вопросы о данных отправляйте через кнопку «Сообщить о проблеме» на сайте.
        </p>
        <p>
          <a href="/" onClick={go('/')}>
            Вернуться к инструменту
          </a>
        </p>
      </section>
    </article>
  );
}
