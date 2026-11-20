import { describe, expect, it } from 'vitest';
import { parseCrop } from '../src/index.js';

describe('parseCrop', () => {
  it('собирает прямоугольник из полей формы', () => {
    expect(
      parseCrop({
        cropX: '10',
        cropY: '20.5',
        cropWidth: '30',
        cropHeight: '40',
      }),
    ).toEqual({ x: 10, y: 20.5, width: 30, height: 40 });
  });

  it('сохраняет отрицательные координаты, если размер положительный', () => {
    expect(
      parseCrop({
        cropX: '-2',
        cropY: '0',
        cropWidth: '3.25',
        cropHeight: '4',
      }),
    ).toEqual({ x: -2, y: 0, width: 3.25, height: 4 });
  });

  it.each([
    ['нет полей', {}],
    ['не хватает высоты', { cropX: '1', cropY: '2', cropWidth: '3' }],
    ['нулевая ширина', { cropX: '1', cropY: '2', cropWidth: '0', cropHeight: '4' }],
    ['отрицательная ширина', { cropX: '1', cropY: '2', cropWidth: '-5', cropHeight: '4' }],
    ['нечисловая координата', { cropX: 'a', cropY: '2', cropWidth: '3', cropHeight: '4' }],
  ])('возвращает undefined, когда %s', (_label, fields) => {
    expect(parseCrop(fields)).toBeUndefined();
  });
});
