import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const fixtureDir = mkdtempSync(join(tmpdir(), 'fitpix-e2e-'));
const imagePath = join(fixtureDir, 'sample.png');

writeFileSync(
  imagePath,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

test('загрузка файла показывает результат оптимизации', async ({ page }) => {
  await page.goto('/');

  const consent = page.getByRole('button', { name: 'Только необходимые' });
  if (await consent.isVisible()) {
    await consent.click();
  }

  await page.locator('input[type="file"]').setInputFiles(imagePath);
  await expect(page.getByText('sample.png')).toBeVisible();
  await expect(page.getByText('ЗАГРУЖЕНО')).toBeVisible();

  await page.getByRole('button', { name: 'Оптимизировать и сжать' }).click();

  await expect(page.getByText('Результат')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Оптимизированное изображение' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Скачать' })).toBeEnabled();
  await expect(page.getByText('ГОТОВО')).toBeVisible();
});
