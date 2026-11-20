import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup,
}));

import { normalizePageUrl } from '../src/analyzePage.js';

describe('normalizePageUrl', () => {
  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('добавляет https и сохраняет путь', async () => {
    const url = await normalizePageUrl('  Example.COM/a/b?q=1#h  ');

    expect(url.href).toBe('https://example.com/a/b?q=1#h');
    expect(lookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
  });

  it('оставляет явный http', async () => {
    const url = await normalizePageUrl('http://public.test/x');

    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('public.test');
    expect(url.pathname).toBe('/x');
  });

  it('принимает публичный IP без DNS', async () => {
    const url = await normalizePageUrl('https://8.8.8.8/path');

    expect(url.hostname).toBe('8.8.8.8');
    expect(url.pathname).toBe('/path');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('принимает публичный IPv6 без DNS', async () => {
    const url = await normalizePageUrl('http://[2001:4860:4860::8888]/');

    expect(url.hostname).toBe('[2001:4860:4860::8888]');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('отклоняет пустой адрес', async () => {
    await expect(normalizePageUrl('   ')).rejects.toThrow('Укажите URL страницы.');
  });

  it('отклоняет неразборчивый адрес', async () => {
    await expect(normalizePageUrl('http://')).rejects.toThrow('Некорректный URL.');
  });

  it('сохраняет явный порт', async () => {
    const url = await normalizePageUrl('https://public.test:8443/a');

    expect(url.port).toBe('8443');
    expect(url.pathname).toBe('/a');
    expect(lookup).toHaveBeenCalledWith('public.test', { all: true, verbatim: true });
  });

  it('отклоняет логин и пароль в URL', async () => {
    await expect(normalizePageUrl('https://user:secret@public.test/a')).rejects.toThrow(
      'URL с логином и паролем не поддерживается.',
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each(['127.0.0.1', '10.0.0.5', '[::1]', '[fc00::1]'])(
    'отклоняет внутренний адрес %s',
    async (host) => {
      await expect(normalizePageUrl(`http://${host}/secret`)).rejects.toThrow(
        'Нельзя анализировать внутренние IP-адреса.',
      );
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it.each(['localhost', 'app.localhost', 'printer.local'])(
    'отклоняет локальное имя %s',
    async (host) => {
      await expect(normalizePageUrl(host)).rejects.toThrow(
        'Нельзя анализировать локальные адреса.',
      );
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it('отклоняет домен, который резолвится во внутренний адрес', async () => {
    lookup.mockResolvedValue([
      { address: '1.2.3.4', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    await expect(normalizePageUrl('https://private.test/page')).rejects.toThrow(
      'Домен указывает на внутренний адрес — анализ недоступен.',
    );
  });

  it('отклоняет домен без DNS-записи', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'));

    await expect(normalizePageUrl('https://missing.test')).rejects.toThrow(
      'Не удалось разрешить домен страницы.',
    );
  });

  it('отклоняет пустой ответ DNS', async () => {
    lookup.mockResolvedValue([]);

    await expect(normalizePageUrl('https://empty.test')).rejects.toThrow(
      'Не удалось разрешить домен страницы.',
    );
  });
});
