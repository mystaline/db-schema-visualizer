import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCanvasAsImage, watermarkSvg } from '../imageExport';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
  toSvg: vi.fn().mockResolvedValue('data:image/svg+xml;base64,fake'),
  getFontEmbedCSS: vi.fn().mockResolvedValue(''),
}));

import * as htmlToImage from 'html-to-image';

const makeNode = (withChild = true): HTMLElement => {
  const el = document.createElement('div');
  if (withChild) {
    const child = document.createElement('div');
    child.textContent = 'table';
    el.appendChild(child);
  }
  return el;
};

describe('exportCanvasAsImage', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // happy-dom doesn't fire load/error events for data URLs, so stub Image to
    // synchronously fail. The export path catches this and ships the plain image.
    vi.spyOn(HTMLImageElement.prototype, 'src' as keyof HTMLImageElement, 'set').mockImplementation(
      function (this: HTMLImageElement) {
        queueMicrotask(() => {
          this.dispatchEvent(new Event('error'));
        });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls toPng with pixelRatio when format is png', async () => {
    await exportCanvasAsImage({
      format: 'png',
      scale: 2,
      node: makeNode(),
      backgroundColor: '#05080c',
    });
    expect(htmlToImage.toPng).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ pixelRatio: 2 }),
    );
  });

  it('calls toSvg when format is svg', async () => {
    await exportCanvasAsImage({
      format: 'svg',
      node: makeNode(),
      backgroundColor: '#ffffff',
    });
    expect(htmlToImage.toSvg).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ backgroundColor: '#ffffff' }),
    );
  });

  it('uses default png filename based on current date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));

    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await exportCanvasAsImage({
      format: 'png',
      node: makeNode(),
      backgroundColor: '#05080c',
    });

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('schemaviz-2024-03-15.png');

    vi.useRealTimers();
  });

  it('uses default svg filename based on current date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));

    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await exportCanvasAsImage({
      format: 'svg',
      node: makeNode(),
      backgroundColor: '#ffffff',
    });

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('schemaviz-2024-03-15.svg');

    vi.useRealTimers();
  });

  it('throws when node has no children', async () => {
    await expect(
      exportCanvasAsImage({
        format: 'png',
        node: makeNode(false),
        backgroundColor: '#05080c',
      }),
    ).rejects.toThrow('Schema is empty');
  });

  it('triggers download by setting download attribute on anchor', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    await exportCanvasAsImage({
      format: 'png',
      filename: 'my-schema.png',
      node: makeNode(),
      backgroundColor: '#05080c',
    });

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('my-schema.png');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe('watermarkSvg', () => {
  const svg = (w: number, h: number) =>
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}"/></svg>`,
    );

  const decode = (dataUrl: string): string => {
    const prefix = 'data:image/svg+xml;charset=utf-8,';
    return decodeURIComponent(dataUrl.slice(prefix.length));
  };

  it('injects two-tone brand wordmark + url wrapped in clickable anchor', () => {
    const out = watermarkSvg(svg(800, 600), '#070a13');
    const decoded = decode(out);
    expect(decoded).toContain('>SCHEMA<');
    expect(decoded).toContain('>VIZ<');
    expect(decoded).toContain('fill="#009eff"'); // VIZ accent
    expect(decoded).toContain('fill="#f3f5f8"'); // SCHEMA tone
    expect(decoded).toContain('schemaviz.mystaline.dev');
    expect(decoded).toContain('href="https://schemaviz.mystaline.dev"');
    expect(decoded).toContain('<title>Made with SchemaViz');
    expect(decoded).toContain('text-anchor="end"');
    expect(decoded).toContain('font-weight="700"');
  });

  it('places the watermark before the closing </svg> tag', () => {
    const out = watermarkSvg(svg(800, 600), '#070a13');
    const decoded = decode(out);
    expect(decoded.endsWith('</svg>')).toBe(true);
    expect(decoded.indexOf('SCHEMA')).toBeLessThan(decoded.lastIndexOf('</svg>'));
  });

  it('uses dim light-on-dark url color for dark backgrounds', () => {
    const out = watermarkSvg(svg(800, 600), '#070a13');
    expect(decode(out)).toContain('fill="rgba(255,255,255,0.35)"');
  });

  it('uses dim dark-on-light url color for light backgrounds', () => {
    const out = watermarkSvg(svg(800, 600), '#ffffff');
    expect(decode(out)).toContain('fill="rgba(0,0,0,0.35)"');
  });

  it('returns input unchanged for non-svg data URLs', () => {
    const png = 'data:image/png;base64,fake';
    expect(watermarkSvg(png, '#ffffff')).toBe(png);
  });
});
