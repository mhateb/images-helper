import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupPromise = vi.hoisted(() => vi.fn());
const lookupCallback = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: lookupPromise,
}));

vi.mock('node:dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns')>();
  return {
    ...actual,
    lookup: lookupCallback,
  };
});

import { fetchRemoteImage, lookupPublicAddress } from '../src/analyzePage.js';

const PUBLIC = [
  { address: '93.184.216.34', family: 4 },
  { address: '2001:4860:4860::8888', family: 6 },
];

function mockDns(addresses: { address: string; family: number }[]) {
  lookupCallback.mockImplementation(
    (
      _hostname: string,
      _options: unknown,
      callback: (error: null, addresses: typeof PUBLIC) => void,
    ) => {
      callback(null, addresses);
    },
  );
}

describe('lookupPublicAddress', () => {
  beforeEach(() => {
    lookupCallback.mockReset();
    mockDns(PUBLIC);
  });

  it('отклоняет локальное имя до DNS', () => {
    lookupPublicAddress('App.localhost', {}, (error) => {
      expect(error).toMatchObject({
        code: 'EBLOCKEDIP',
        message: 'Нельзя анализировать локальные адреса.',
      });
    });
    expect(lookupCallback).not.toHaveBeenCalled();
  });

  it('отклоняет внутренний IP-литерал до DNS', () => {
    lookupPublicAddress('[::ffff:127.0.0.1]', { all: true }, (error) => {
      expect(error).toMatchObject({
        code: 'EBLOCKEDIP',
        message: 'Нельзя анализировать внутренние IP-адреса.',
      });
    });
    expect(lookupCallback).not.toHaveBeenCalled();
  });

  it('отдаёт публичный IP-литерал без DNS', () => {
    lookupPublicAddress('8.8.8.8', { all: true }, (error, addresses) => {
      expect(error).toBeNull();
      expect(addresses).toEqual([{ address: '8.8.8.8', family: 4 }]);
    });
    expect(lookupCallback).not.toHaveBeenCalled();
  });

  it('запрашивает все записи и возвращает их сокету', () => {
    lookupPublicAddress('public.test', { all: true, family: 0 }, (error, addresses) => {
      expect(error).toBeNull();
      expect(addresses).toEqual(PUBLIC);
    });
    expect(lookupCallback).toHaveBeenCalledWith(
      'public.test',
      expect.objectContaining({ all: true, verbatim: true, family: 0 }),
      expect.any(Function),
    );
  });

  it('без all отдаёт первый публичный адрес', () => {
    lookupPublicAddress('public.test', {}, (error, address, family) => {
      expect(error).toBeNull();
      expect(address).toBe('93.184.216.34');
      expect(family).toBe(4);
    });
  });

  it('отклоняет набор, где хотя бы один адрес внутренний', () => {
    mockDns([
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    lookupPublicAddress('mixed.test', { all: true }, (error) => {
      expect(error).toMatchObject({
        code: 'EBLOCKEDIP',
        message: 'Домен указывает на внутренний адрес — анализ недоступен.',
      });
    });
  });

  it('пробрасывает ошибку DNS', () => {
    const dnsError = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    lookupCallback.mockImplementation((_hostname: string, _options: unknown, callback: (error: Error) => void) => {
      callback(dnsError);
    });

    lookupPublicAddress('missing.test', { all: true }, (error) => {
      expect(error).toBe(dnsError);
    });
  });
});

describe('DNS rebinding на соединении', () => {
  beforeEach(() => {
    lookupPromise.mockReset();
    lookupPromise.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    lookupCallback.mockReset();
    mockDns([{ address: '127.0.0.1', family: 4 }]);
  });

  it('не открывает сокет, если второй резолв уже внутренний', async () => {
    const hits: string[] = [];
    const server = http.createServer((request, response) => {
      hits.push(request.url ?? '');
      response.end('secret');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    try {
      await expect(fetchRemoteImage(`http://rebinding.test:${port}/secret`)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
        message: 'Домен указывает на внутренний адрес — анализ недоступен.',
      });
      expect(hits).toEqual([]);
      expect(lookupPromise).toHaveBeenCalled();
      expect(lookupCallback).toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('на https тоже останавливается до TCP', async () => {
    await expect(fetchRemoteImage('https://rebinding.test/a.png')).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
      message: 'Домен указывает на внутренний адрес — анализ недоступен.',
    });
    expect(lookupCallback).toHaveBeenCalled();
  });

  it('литерал loopback не доходит до сокета', async () => {
    const hits: string[] = [];
    const server = http.createServer((request, response) => {
      hits.push(request.url ?? '');
      response.end('secret');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    try {
      await expect(fetchRemoteImage(`http://127.0.0.1:${port}/secret`)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Нельзя анализировать внутренние IP-адреса.',
      });
      expect(hits).toEqual([]);
      expect(lookupCallback).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});
