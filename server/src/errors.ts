type AppErrorOptions = {
  cause?: unknown;
  /** Попадает в структурный лог, в ответ клиенту не сериализуется. */
  details?: Record<string, unknown>;
};

/** Запрос отклонён: некорректный или запрещённый ввод. */
export class ValidationError extends Error {
  readonly statusCode = 400 as const;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ValidationError';
    if (options?.details) this.details = options.details;
  }
}

/**
 * Удалённая сторона или её ответ не позволили выполнить запрос.
 * 422 — ожидаемый отказ (таймаут, код ответа, не тот тип содержимого).
 * 502 — сбой при обращении к источнику.
 */
export class UpstreamError extends Error {
  readonly statusCode: 422 | 502;
  readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode: 422 | 502 = 502, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
    if (options?.details) this.details = options.details;
  }
}
