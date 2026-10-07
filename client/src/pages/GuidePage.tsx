import { useState } from 'react';
import { BP } from '../constants/breakpoints';
import styles from './GuidePage.module.css';

type TabId = 'basics' | 'source' | 'media' | 'srcset';

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'basics', label: 'Основы', hint: 'Форматы и тул' },
  { id: 'source', label: 'source', hint: 'Как выбирается файл' },
  { id: 'media', label: 'media', hint: 'md / lg / xl' },
  { id: 'srcset', label: 'srcset', hint: 'Ширины и ресайз' },
];

export function GuidePage() {
  const [tab, setTab] = useState<TabId>('basics');

  return (
    <article className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Документация</p>
        <h1>Гайд по оптимизации картинок для веба</h1>
        <p className={styles.lead}>
          Подготовка ассетов под{' '}
          <code className={styles.code}>{'<picture>'}</code> с брейкпоинтами проекта:{' '}
          <strong>md {BP.md}</strong>, <strong>lg {BP.lg}</strong>,{' '}
          <strong>xl {BP.xl}</strong> — и разрешение под реальный слот в вёрстке.
        </p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Разделы гайда">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`guide-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`guide-panel-${item.id}`}
            className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>

      <div
        className={styles.panel}
        role="tabpanel"
        id={`guide-panel-${tab}`}
        aria-labelledby={`guide-tab-${tab}`}
      >
        {tab === 'basics' ? <BasicsTab /> : null}
        {tab === 'source' ? <SourceTab /> : null}
        {tab === 'media' ? <MediaTab /> : null}
        {tab === 'srcset' ? <SrcsetTab /> : null}
      </div>
    </article>
  );
}

function BreakpointsTable() {
  return (
    <div className={styles.bpTable} role="table" aria-label="Брейкпоинты проекта">
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          &lt; md
        </span>
        <span role="cell">&lt; {BP.md}px</span>
        <span role="cell">mobile</span>
      </div>
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          md
        </span>
        <span role="cell">{BP.md}px</span>
        <span role="cell">tablet</span>
      </div>
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          lg
        </span>
        <span role="cell">{BP.lg}px</span>
        <span role="cell">tablet-lg / desktop-small</span>
      </div>
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          xl
        </span>
        <span role="cell">{BP.xl}px</span>
        <span role="cell">desktop</span>
      </div>
    </div>
  );
}

function ExampleDirol() {
  return (
    <section className={styles.section}>
      <h2>Пример: пачка жвачки из Figma</h2>
      <p className={styles.text}>
        Типичный кейс с фронта: в макете маленькая картинка товара, а исходник — огромный
        файл со студии / из выгрузки.
      </p>

      <h3 className={styles.sub}>1. Что пришло</h3>
      <p className={styles.text}>
        Пачка Dirol на белом фоне. Вес <strong>363 KB</strong>, разрешение{' '}
        <strong>3507×2480</strong>. Сам объект крошечный относительно кадра — вокруг куча
        пустого поля, которое в UI всё равно не видно.
      </p>

      <figure className={styles.figure}>
        <img
          src="/guide/example-crop.png"
          alt="Обрезка пачки Dirol: рамка вокруг жвачки на большом белом фоне"
          className={styles.figureImg}
          loading="lazy"
        />
        <figcaption>
          Обрезаем до пачки — на сервер уйдёт только нужная область, потом автообрезка краёв и
          изменение размера.
        </figcaption>
      </figure>

      <h3 className={styles.sub}>2. Что говорит Figma</h3>
      <p className={styles.text}>
        В макете слот картинки <strong>не шире 300 CSS-пикселей</strong> на всех брейкпоинтах
        (карточка / превью). Значит тащить 3507px бессмысленно: браузер всё равно сожмёт
        визуально, а по сети уедут лишние сотни килобайт.
      </p>

      <h3 className={styles.sub}>3. Как ресайзим</h3>
      <ol className={styles.steps}>
        <li>Обрезка по контуру пачки (как на кадре выше).</li>
        <li>
          Включаем Resize. Макс. ширина ={' '}
          <code className={styles.code}>300 × 2 = 600</code> — запас под retina (DPR 2).
          Одного файла 600w обычно хватает, если слот всегда ~300px.
        </li>
        <li>Качество ~80, формат Optimized (или сразу «Скачать все» под picture).</li>
        <li>Оптимизировать.</li>
      </ol>

      <figure className={styles.figure}>
        <img
          src="/guide/example-result.png"
          alt="Результат: Dirol_1.jpg, вес 21 KB, разрешение 3507×2480 → 600×171"
          className={styles.figureImg}
          loading="lazy"
        />
        <figcaption>
          Итог: <strong>363 KB → 21 KB</strong> (−94%), разрешение{' '}
          <strong>3507×2480 → 600×171</strong>.
        </figcaption>
      </figure>

      <div className={styles.callout}>
        <p>
          Формула: <code className={styles.code}>ширина в Figma × 2</code> (или ваш
          максимальный DPR). Слот 300px → файл 600px. Не 3507 «на всякий случай» и не 300 без
          запаса под retina — будет мыльно на iPhone / Retina-ноутах.
        </p>
      </div>

      <h3 className={styles.sub}>4. В вёрстку</h3>
      <pre className={styles.snippet} tabIndex={0}>
        <code>{`<picture>
  <source srcset="/dirol-600.avif" type="image/avif" />
  <source srcset="/dirol-600.webp" type="image/webp" />
  <img
    src="/dirol-600.jpg"
    alt="Dirol White"
    width="300"
    height="86"
  />
</picture>`}</code>
      </pre>
      <p className={styles.text}>
        В <code className={styles.code}>width</code> / CSS — 300 (слот из Figma), файл —
        600px. Если слот прыгает по брейкпоинтам — смотрите вкладку <strong>srcset</strong>.
      </p>
    </section>
  );
}

function BasicsTab() {
  return (
    <>
      <section className={styles.sectionFirst}>
        <h2>Брейкпоинты проекта</h2>
        <p className={styles.text}>
          В <code className={styles.code}>{'<picture>'}</code> и в{' '}
          <code className={styles.code}>sizes</code> используем те же точки, что в CSS:
        </p>
        <BreakpointsTable />
        <p className={styles.text}>
          Mobile — всё ниже md. Арт-директинг и srcset завязывайте на эти значения, не на
          произвольные 700 / 900.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Типичный сценарий</h2>
        <ol className={styles.steps}>
          <li>Загрузите исходник (фото, экспорт из Figma, скрин).</li>
          <li>Обрезкой уберите лишнее — отдельно под mobile и под md+ при разной композиции.</li>
          <li>
            Resize под ширины лестницы (часто {BP.md} / {BP.lg} / {BP.xl} и ×2) — вкладка{' '}
            <strong>srcset</strong>.
          </li>
          <li>
            Скачайте ZIP со всеми форматами → в{' '}
            <code className={styles.code}>public/</code> или на CDN.
          </li>
          <li>
            В разметке: media по md/lg/xl + AVIF → WebP → fallback.
          </li>
        </ol>
      </section>

      <ExampleDirol />

      <section className={styles.section}>
        <h2>Какой формат когда использовать</h2>
        <p className={styles.text}>
          Браузер берёт первый подходящий <code className={styles.code}>{'<source>'}</code>{' '}
          сверху вниз. Подробнее — вкладка <strong>source</strong>.
        </p>

        <div className={styles.cards}>
          <div className={styles.card}>
            <h3>AVIF</h3>
            <p>
              Лучшее сжатие — верхний слой в picture для hero и фото-блоков. Современные
              Chromium, Firefox и Safari его понимают.
            </p>
            <p className={styles.when}>
              <strong>Из тула:</strong> почти всегда как первый кандидат для веба.
            </p>
          </div>

          <div className={styles.card}>
            <h3>WebP</h3>
            <p>
              Чуть тяжелее AVIF, поддержка шире на старых Android / WebView. Средний слой,
              если AVIF не подошёл.
            </p>
            <p className={styles.when}>
              <strong>Из тула:</strong> второй{' '}
              <code className={styles.code}>{'<source>'}</code> или единственный современный
              формат.
            </p>
          </div>

          <div className={styles.card}>
            <h3>Optimized (JPEG / PNG)</h3>
            <p>
              Сжатый исходный формат — fallback в{' '}
              <code className={styles.code}>{'<img src>'}</code>.
            </p>
            <p className={styles.when}>
              <strong>Из тула:</strong> всегда рядом с AVIF/WebP. JPEG для фото; PNG — если
              нужна прозрачность без WebP/AVIF.
            </p>
          </div>
        </div>

        <div className={styles.callout}>
          <p>
            «Скачать все» даёт три файла с одной обрезкой, resize и качеством. В проде: AVIF →
            WebP → Optimized JPEG/PNG.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Параметры формы</h2>
        <dl className={styles.params}>
          <div>
            <dt>Обрезка</dt>
            <dd>
              Уберите то, чего не будет в UI. На сервере: обрезка → автообрезка краёв → изменение размера → сжатие. Для
              разных композиций mobile / md+ готовьте отдельные прогоны.
            </dd>
          </div>
          <div>
            <dt>Trim</dt>
            <dd>
              Срезает однотонные края после обрезки. Удобно для скринов; на фото с градиентом
              проверяйте превью.
            </dd>
          </div>
          <div>
            <dt>Resize / макс. ширина</dt>
            <dd>
              Одна ступень лестницы srcset за проход. Ориентиры: {BP.md}, {BP.lg}, {BP.xl} и
              удвоенные под retina ({BP.md * 2}, {BP.lg * 2}, {BP.xl * 2}). Увеличение
              отключено.
            </dd>
          </div>
          <div>
            <dt>Качество</dt>
            <dd>
              40–100. Для веба стартуйте с 75–85. Сравнивайте «было / стало» и превью на фоне
              страницы.
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2>Чеклист перед коммитом</h2>
        <ul className={styles.checklist}>
          <li>
            Media / sizes завязаны на md {BP.md} / lg {BP.lg} / xl {BP.xl}, как в CSS.
          </li>
          <li>Есть лестница ширин под слот × DPR или один файл ≈ слот × 2.</li>
          <li>AVIF + WebP + JPEG/PNG fallback.</li>
          <li>width/height или aspect-ratio — меньше CLS.</li>
          <li>Lazy ниже fold; hero — без lazy / с приоритетом.</li>
        </ul>
      </section>
    </>
  );
}

function SourceTab() {
  return (
    <>
      <section className={styles.sectionFirst}>
        <h2>Как работает {'<source>'}</h2>
        <p className={styles.text}>
          Внутри <code className={styles.code}>{'<picture>'}</code> браузер сверху вниз
          смотрит каждый <code className={styles.code}>{'<source>'}</code>. Первый, чьи
          условия выполнены, становится источником для{' '}
          <code className={styles.code}>{'<img>'}</code>. Остальные не качаются.
        </p>

        <pre className={styles.snippet} tabIndex={0}>
          <code>{`<picture>
  <source srcset="hero.avif" type="image/avif" />
  <source srcset="hero.webp" type="image/webp" />
  <img src="hero.jpg" alt="Hero" width="${BP.xl}" height="720" />
</picture>`}</code>
        </pre>
      </section>

      <section className={styles.section}>
        <h2>Порядок проверки</h2>
        <ol className={styles.steps}>
          <li>
            Есть ли <code className={styles.code}>media</code>? Если да и медиазапрос{' '}
            <em>не</em> совпал — source пропускается.
          </li>
          <li>
            Есть ли <code className={styles.code}>type</code>? Если формат браузер не умеет —
            source пропускается.
          </li>
          <li>
            Из подходящего source берётся URL через{' '}
            <code className={styles.code}>srcset</code> /{' '}
            <code className={styles.code}>sizes</code>.
          </li>
          <li>
            Если ни один source не подошёл —{' '}
            <code className={styles.code}>{'<img src>'}</code> (и его srcset, если есть).
          </li>
        </ol>

        <div className={styles.callout}>
          <p>
            Сначала узкие media (mobile → md → lg → xl) и современные type (AVIF → WebP),
            внизу — общие. Первый совпавший побеждает.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Атрибуты source</h2>
        <dl className={styles.params}>
          <div>
            <dt>type</dt>
            <dd>
              MIME: <code className={styles.code}>image/avif</code>,{' '}
              <code className={styles.code}>image/webp</code>. Без поддержки формата source
              игнорируется.
            </dd>
          </div>
          <div>
            <dt>srcset</dt>
            <dd>
              Один URL или кандидаты с w-дескрипторами (
              <code className={styles.code}>{BP.md}w</code>,{' '}
              <code className={styles.code}>{BP.lg}w</code>,{' '}
              <code className={styles.code}>{BP.xl}w</code>…). Подробнее — вкладка{' '}
              <strong>srcset</strong>.
            </dd>
          </div>
          <div>
            <dt>sizes</dt>
            <dd>
              CSS-ширина слота по брейкпоинтам проекта, например{' '}
              <code className={styles.code}>
                {`(max-width: ${BP.md - 1}px) 100vw, (max-width: ${BP.lg - 1}px) 50vw, 400px`}
              </code>
              . Без sizes при w-дескрипторах браузер часто считает слот = весь viewport.
            </dd>
          </div>
          <div>
            <dt>media</dt>
            <dd>
              Запросы на md / lg / xl из токенов проекта. Арт-директинг — вкладка{' '}
              <strong>media</strong>.
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2>Зачем нужен img внутри picture</h2>
        <ul className={styles.list}>
          <li>
            Обязательный fallback и «настоящий» элемент (alt, размеры, lazy, decoding).
          </li>
          <li>
            <code className={styles.code}>source</code> только подменяет ресурс для img.
          </li>
          <li>
            В <code className={styles.code}>src</code> — самый совместимый файл (обычно
            JPEG/PNG из «Optimized»).
          </li>
        </ul>
      </section>
    </>
  );
}

function MediaTab() {
  return (
    <>
      <section className={styles.sectionFirst}>
        <h2>Media под брейкпоинты проекта</h2>
        <p className={styles.text}>
          В <code className={styles.code}>{'<picture>'}</code> чаще всего режем по тем же
          точкам, что лейаут:
        </p>
        <BreakpointsTable />
        <p className={styles.text}>
          <code className={styles.code}>media</code> — обычный CSS media query. Source
          участвует только при совпадении. Так меняют обрезку/композицию между mobile, tablet
          (md), tablet-lg (lg) и desktop (xl) — не просто тот же файл помельче.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Как писать media</h2>
        <p className={styles.text}>
          Mobile-first: более узкие диапазоны сверху, xl / без media — запасной широкий кадр
          внизу. Границы — <strong>на пиксель меньше следующего токена</strong>, чтобы не
          пересекаться с CSS{' '}
          <code className={styles.code}>{`min-width: ${BP.md}px`}</code> и т.п.
        </p>

        <dl className={styles.params}>
          <div>
            <dt>mobile</dt>
            <dd>
              <code className={styles.code}>{`(max-width: ${BP.md - 1}px)`}</code> — всё до
              tablet.
            </dd>
          </div>
          <div>
            <dt>md — tablet</dt>
            <dd>
              <code className={styles.code}>
                {`(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)`}
              </code>
            </dd>
          </div>
          <div>
            <dt>lg — tablet-lg / desktop-small</dt>
            <dd>
              <code className={styles.code}>
                {`(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)`}
              </code>
            </dd>
          </div>
          <div>
            <dt>xl — desktop</dt>
            <dd>
              <code className={styles.code}>{`(min-width: ${BP.xl}px)`}</code> или source без
              media как финальный fallback.
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2>Пример: арт-директинг mobile / md+ </h2>
        <p className={styles.text}>
          Частый кейс — другая обрезка до md и общий кадр с md и выше. Внутри каждого media —
          AVIF → WebP → JPEG.
        </p>

        <pre className={styles.snippet} tabIndex={0}>
          <code>{`<picture>
  <!-- mobile: < md (${BP.md}) -->
  <source
    media="(max-width: ${BP.md - 1}px)"
    srcset="hero-mobile.avif"
    type="image/avif"
  />
  <source
    media="(max-width: ${BP.md - 1}px)"
    srcset="hero-mobile.webp"
    type="image/webp"
  />
  <source
    media="(max-width: ${BP.md - 1}px)"
    srcset="hero-mobile.jpg"
  />

  <!-- md+ (tablet → desktop): широкий кадр -->
  <source srcset="hero-desktop.avif" type="image/avif" />
  <source srcset="hero-desktop.webp" type="image/webp" />
  <img src="hero-desktop.jpg" alt="Hero" width="${BP.xl}" height="720" />
</picture>`}</code>
        </pre>
      </section>

      <section className={styles.section}>
        <h2>Пример: все четыре диапазона</h2>
        <p className={styles.text}>
          Когда на md / lg / xl реально разные композиции (не только ширина файла):
        </p>

        <pre className={styles.snippet} tabIndex={0}>
          <code>{`<picture>
  <!-- mobile -->
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.avif" type="image/avif" />
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.webp" type="image/webp" />
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.jpg" />

  <!-- md: tablet -->
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.avif"
    type="image/avif"
  />
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.webp"
    type="image/webp"
  />
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.jpg"
  />

  <!-- lg: tablet-lg / desktop-small -->
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.avif"
    type="image/avif"
  />
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.webp"
    type="image/webp"
  />
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.jpg"
  />

  <!-- xl: desktop -->
  <source srcset="shot-xl.avif" type="image/avif" />
  <source srcset="shot-xl.webp" type="image/webp" />
  <img src="shot-xl.jpg" alt="…" width="${BP.xl}" height="720" />
</picture>`}</code>
        </pre>
      </section>

      <section className={styles.section}>
        <h2>Когда нужен media, а когда хватит srcset</h2>
        <div className={styles.cards}>
          <div className={styles.card}>
            <h3>Только srcset + sizes</h3>
            <p>
              Одна композиция на всех брейкпоинтах, меняется лишь разрешение. В{' '}
              <code className={styles.code}>sizes</code> укажите слот на mobile / md / lg /
              xl — браузер сам выберет файл из лестницы.
            </p>
          </div>
          <div className={styles.card}>
            <h3>Нужен media</h3>
            <p>
              На mobile другая обрезка, на md — ещё одна, на xl — третий. Или другое изображение
              целиком. Srcset кадр не меняет.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Правила</h2>
        <ul className={styles.list}>
          <li>
            Только токены проекта: {BP.md} / {BP.lg} / {BP.xl}. Не вводите «около 700» или
            «900».
          </li>
          <li>
            Более специфичные media выше; xl или source без media — внизу.
          </li>
          <li>
            Внутри одного диапазона: AVIF → WebP → JPEG.
          </li>
          <li>
            <code className={styles.code}>media</code> смотрит на viewport, не на ширину
            колонки. Слот в сайдбаре — через sizes + srcset.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Как готовить файлы в туле</h2>
        <ol className={styles.steps}>
          <li>
            Исходник → обрезка под <strong>mobile</strong> → Resize (см. srcset) → «Скачать все»
            → <code className={styles.code}>*-mobile.*</code>.
          </li>
          <li>
            При необходимости отдельные обрезки для <strong>md</strong>, <strong>lg</strong>,{' '}
            <strong>xl</strong> — каждый своим ZIP с суффиксом{' '}
            <code className={styles.code}>*-md|lg|xl.*</code>.
          </li>
          <li>
            Если с md композиция одна — достаточно пары mobile / desktop (md+), как в первом
            примере.
          </li>
        </ol>
      </section>
    </>
  );
}

function SrcsetTab() {
  return (
    <>
      <section className={styles.sectionFirst}>
        <h2>Srcset под слоты md / lg / xl</h2>
        <p className={styles.text}>
          Лестницу ширин и <code className={styles.code}>sizes</code> строим от брейкпоинтов
          проекта. Браузер выбирает файл ≈{' '}
          <code className={styles.code}>CSS-ширина слота × devicePixelRatio</code>.
        </p>
        <BreakpointsTable />

        <pre className={styles.snippet} tabIndex={0}>
          <code>{`<picture>
  <source
    type="image/avif"
    srcset="
      card-${BP.md}.avif ${BP.md}w,
      card-${BP.lg}.avif ${BP.lg}w,
      card-${BP.xl}.avif ${BP.xl}w,
      card-${BP.xl * 2}.avif ${BP.xl * 2}w
    "
    sizes="
      (max-width: ${BP.md - 1}px) 100vw,
      (max-width: ${BP.lg - 1}px) 50vw,
      (max-width: ${BP.xl - 1}px) 400px,
      400px
    "
  />
  <source
    type="image/webp"
    srcset="
      card-${BP.md}.webp ${BP.md}w,
      card-${BP.lg}.webp ${BP.lg}w,
      card-${BP.xl}.webp ${BP.xl}w,
      card-${BP.xl * 2}.webp ${BP.xl * 2}w
    "
    sizes="
      (max-width: ${BP.md - 1}px) 100vw,
      (max-width: ${BP.lg - 1}px) 50vw,
      (max-width: ${BP.xl - 1}px) 400px,
      400px
    "
  />
  <img
    src="card-${BP.lg}.jpg"
    srcset="
      card-${BP.md}.jpg ${BP.md}w,
      card-${BP.lg}.jpg ${BP.lg}w,
      card-${BP.xl}.jpg ${BP.xl}w,
      card-${BP.xl * 2}.jpg ${BP.xl * 2}w
    "
    sizes="
      (max-width: ${BP.md - 1}px) 100vw,
      (max-width: ${BP.lg - 1}px) 50vw,
      (max-width: ${BP.xl - 1}px) 400px,
      400px
    "
    alt="Карточка"
    width="400"
    height="300"
  />
</picture>`}</code>
        </pre>
      </section>

      <section className={styles.section}>
        <h2>sizes на брейкпоинтах проекта</h2>
        <dl className={styles.params}>
          <div>
            <dt>{`(max-width: ${BP.md - 1}px)`} — mobile</dt>
            <dd>
              Часто <code className={styles.code}>100vw</code> для full-bleed или доля
              колонки, как в макете.
            </dd>
          </div>
          <div>
            <dt>{`(max-width: ${BP.lg - 1}px)`} — до lg (включая md)</dt>
            <dd>
              Слот tablet: например <code className={styles.code}>50vw</code> в двухколоночной
              сетке.
            </dd>
          </div>
          <div>
            <dt>{`(max-width: ${BP.xl - 1}px)`} — lg</dt>
            <dd>tablet-lg / desktop-small — фиксированный слот или vw из вёрстки.</dd>
          </div>
          <div>
            <dt>хвост — xl+</dt>
            <dd>
              Финальное значение без media (например{' '}
              <code className={styles.code}>400px</code> или{' '}
              <code className={styles.code}>33vw</code>) для desktop.
            </dd>
          </div>
        </dl>
        <p className={styles.text}>
          w-дескриптор — реальная ширина файла в пикселях; она должна совпадать с Resize в
          туле.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Какие ширины резать в туле</h2>
        <p className={styles.text}>
          Базовые ступени = токены брейкпоинтов. Для retina добавьте ×2. Не плодите лишние
          промежутки.
        </p>

        <ul className={styles.list}>
          <li>
            <strong>Фиксированный слот ~300px</strong> (как пачка жвачки во вкладке Основы) —
            один файл 600w = 300 × 2. Лестница md/lg не нужна, если ширина в макете не
            растёт.
          </li>
          <li>
            <strong>Карточка ~320–400px</strong> с разной шириной по брейкпоинтам — {BP.md} /{' '}
            {BP.lg} (иногда {BP.xl} под 3×).
          </li>
          <li>
            <strong>Контентная колонка / полширины</strong> — {BP.md} / {BP.lg} / {BP.xl} /{' '}
            {BP.xl * 2}.
          </li>
          <li>
            <strong>Full-bleed hero</strong> — {BP.md} / {BP.lg} / {BP.xl} / {BP.xl * 2}; при
            full-bleed на lg с DPR=2 добавьте ещё {BP.lg * 2}.
          </li>
        </ul>

        <div className={styles.callout}>
          <p>
            Пример: слот на xl = 400px, DPR=2 → нужно ~800px → хватит кандидата{' '}
            {BP.lg}w или ближайшего большего. Файл {BP.xl * 2}w на узкую карточку почти не
            нужен.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Прогон в туле</h2>
        <ol className={styles.steps}>
          <li>Одна обрезка и автообрезка краёв на всю лестницу (одна композиция).</li>
          <li>
            Resize = {BP.md} → «Скачать все» →{' '}
            <code className={styles.code}>{`name-${BP.md}.avif|webp|jpg`}</code>.
          </li>
          <li>
            Resize = {BP.lg} → ZIP →{' '}
            <code className={styles.code}>{`name-${BP.lg}.*`}</code>.
          </li>
          <li>
            Resize = {BP.xl} → ZIP →{' '}
            <code className={styles.code}>{`name-${BP.xl}.*`}</code>.
          </li>
          <li>
            При необходимости Resize = {BP.xl * 2} (retina desktop) →{' '}
            <code className={styles.code}>{`name-${BP.xl * 2}.*`}</code>.
          </li>
          <li>
            В srcset у каждого файла тот же{' '}
            <code className={styles.code}>Nw</code>; один{' '}
            <code className={styles.code}>sizes</code> на все source и img.
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>media + srcset вместе</h2>
        <p className={styles.text}>
          Разная обрезка на mobile и md+ — вкладка <strong>media</strong>. Внутри каждого media
          можно дать свою лестницу{' '}
          <code className={styles.code}>{`${BP.md}w, ${BP.lg}w…`}</code>, если слот сильно
          гуляет внутри диапазона. Часто для mobile хватает 1–2 ширин, для md+ — полной
          лестницы до {BP.xl} / {BP.xl * 2}.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Когда урезать</h2>
        <ul className={styles.list}>
          <li>
            Исходник шире верхнего кандидата (сток 4000px, лестница до {BP.xl * 2}) — режьте.
          </li>
          <li>
            Слот маленький — не тащите hero {BP.xl * 2} «на будущее».
          </li>
          <li>
            Разные обрезки mobile / md / lg / xl — сначала media-композиции, потом ресайз
            каждой.
          </li>
          <li>
            Не апскейльте: исходник 900px и кандидат {BP.xl}w бессмысленны — тул не увеличит,
            дескриптор обманет браузер.
          </li>
        </ul>
      </section>
    </>
  );
}
