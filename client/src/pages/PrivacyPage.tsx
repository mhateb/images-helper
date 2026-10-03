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
          Fitpix.ru — бесплатный онлайн-инструмент оптимизации изображений. Ниже — какие данные
          мы обрабатываем и зачем.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Обработка изображений</h2>
        <p>
          Файлы, которые вы загружаете, обрабатываются на сервере в оперативной памяти и не
          сохраняются на диск. Мы не создаём аккаунты и не ведём архив ваших картинок.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Яндекс.Метрика</h2>
        <p>
          Если вы нажали «Принимаю» в баннере cookies, на сайте работает счётчик Яндекс.Метрики.
          Он помогает понять посещаемость, источники трафика и то, доходят ли пользователи до
          оптимизации и скачивания. Метрика может использовать cookies и схожие технологии.
        </p>
        <p>
          Вы можете отказаться: выберите «Только необходимые» в баннере или очистите данные сайта
          в браузере — тогда аналитика не загрузится.
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
          Если вы отправляете сообщение о проблеме, мы получаем текст описания, опциональный email
          для ответа и опциональный скриншот. Эти данные нужны только чтобы разобрать проблему и
          при возможности ответить. Не передавайте в форме пароли и другие секреты.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Контакты</h2>
        <p>
          По вопросам обработки данных используйте кнопку «Сообщить о проблеме» на сайте или
          напишите на адрес, указанный в ответе на ваше сообщение.
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
