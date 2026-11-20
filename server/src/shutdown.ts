import type { FastifyInstance } from 'fastify';

/** Чуть меньше типичного stop_grace_period, чтобы успеть выйти до SIGKILL. */
const DEFAULT_TIMEOUT_MS = 10_000;

type Exit = (code: number) => void;

export type ShutdownOptions = {
  exit?: Exit;
  timeoutMs?: number;
};

const state = new WeakMap<FastifyInstance, { stopped: boolean }>();

export function shutdownApp(
  app: FastifyInstance,
  signal: string,
  options: ShutdownOptions = {},
): void {
  const current = state.get(app) ?? { stopped: false };
  if (current.stopped) return;
  current.stopped = true;
  state.set(app, current);

  const exit = options.exit ?? ((code: number) => process.exit(code));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const finish = (code: number) => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    exit(code);
  };

  app.log.info({ signal }, 'shutdown started');

  timer = setTimeout(() => {
    app.log.error({ signal, timeoutMs }, 'shutdown timed out');
    finish(1);
  }, timeoutMs);
  timer.unref();

  app.close().then(
    () => {
      app.log.info({ signal }, 'shutdown complete');
      finish(0);
    },
    (error: unknown) => {
      app.log.error({ err: error, signal }, 'shutdown failed');
      finish(1);
    },
  );
}

/** SIGTERM от Docker/systemd и SIGINT от Ctrl+C. Возвращает снятие обработчиков. */
export function registerGracefulShutdown(app: FastifyInstance): () => void {
  const onTerm = () => shutdownApp(app, 'SIGTERM');
  const onInt = () => shutdownApp(app, 'SIGINT');
  const onException = (error: Error) => {
    app.log.fatal({ err: error }, 'uncaught exception');
    shutdownApp(app, 'uncaughtException');
  };
  const onRejection = (reason: unknown) => {
    app.log.fatal({ err: reason }, 'unhandled rejection');
    shutdownApp(app, 'unhandledRejection');
  };

  process.once('SIGTERM', onTerm);
  process.once('SIGINT', onInt);
  process.once('uncaughtException', onException);
  process.once('unhandledRejection', onRejection);

  return () => {
    process.off('SIGTERM', onTerm);
    process.off('SIGINT', onInt);
    process.off('uncaughtException', onException);
    process.off('unhandledRejection', onRejection);
  };
}
