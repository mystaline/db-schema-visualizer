import * as htmlToImage from 'html-to-image';

export type ImageFormat = 'png' | 'svg';
export type ImageScale = 1 | 2 | 3;

export interface ExportCanvasOptions {
  format: ImageFormat;
  scale?: ImageScale;
  filename?: string;
  /** DOM node to render. Must be the canvas content node (tables + FK lines). */
  node: HTMLElement;
  /** Theme bg color to fill behind transparent areas. */
  backgroundColor: string;
}

const WATERMARK_BRAND_HEAD = 'SCHEMA';
const WATERMARK_BRAND_TAIL = 'VIZ';
const WATERMARK_URL_TEXT = 'schemaviz.mystaline.dev';
const WATERMARK_URL = 'https://schemaviz.mystaline.dev';
const WATERMARK_TITLE = 'Made with SchemaViz — schemaviz.mystaline.dev';
const BRAND_HEAD_COLOR = '#f3f5f8'; // secondary-50, the "SCHEMA" tone
const BRAND_TAIL_COLOR = '#009eff'; // primary-400, the "VIZ" accent

const defaultFilename = (format: ImageFormat): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `schemaviz-${yyyy}-${mm}-${dd}.${format}`;
};

const noExportFilter = (node: Node): boolean => {
  if (node instanceof Element && node.classList.contains('no-export')) {
    return false;
  }
  return true;
};

const isLightBackground = (hex: string): boolean => {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
};

const loadImage = (src: string, timeoutMs = 3000): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('image load timed out')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to load image for watermarking'));
    };
    img.src = src;
  });

export async function watermarkPng(
  dataUrl: string,
  scale: ImageScale,
  backgroundColor: string,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);

  const brandSize = 20 * scale;
  const urlSize = 11 * scale;
  const padding = 20 * scale;
  const lineGap = 4 * scale;
  const dimColor = isLightBackground(backgroundColor)
    ? 'rgba(0,0,0,0.35)'
    : 'rgba(255,255,255,0.35)';

  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const rightX = canvas.width - padding;

  ctx.font = `400 ${urlSize}px "Space Mono", ui-monospace, monospace`;
  ctx.fillStyle = dimColor;
  ctx.fillText(WATERMARK_URL_TEXT, rightX, canvas.height - padding);

  // Brand wordmark: SCHEMA (light) + VIZ (accent), drawn right-anchored so VIZ
  // sits on the right edge and SCHEMA flows left from it.
  ctx.font = `700 ${brandSize}px "Space Mono", ui-monospace, monospace`;
  ctx.letterSpacing = `${scale}px`;
  const brandY = canvas.height - padding - urlSize - lineGap;
  ctx.fillStyle = BRAND_TAIL_COLOR;
  ctx.fillText(WATERMARK_BRAND_TAIL, rightX, brandY);
  const tailWidth = ctx.measureText(WATERMARK_BRAND_TAIL).width;
  ctx.fillStyle = BRAND_HEAD_COLOR;
  ctx.fillText(WATERMARK_BRAND_HEAD, rightX - tailWidth, brandY);
  return canvas.toDataURL('image/png');
}

export function watermarkSvg(dataUrl: string, backgroundColor: string): string {
  const prefix = 'data:image/svg+xml;charset=utf-8,';
  if (!dataUrl.startsWith(prefix)) return dataUrl;
  const svgText = decodeURIComponent(dataUrl.slice(prefix.length));
  const wMatch = svgText.match(/<svg[^>]*\swidth="([\d.]+)"/);
  const hMatch = svgText.match(/<svg[^>]*\sheight="([\d.]+)"/);
  if (!wMatch || !hMatch) return dataUrl;
  const w = parseFloat(wMatch[1]);
  const h = parseFloat(hMatch[1]);

  const dimColor = isLightBackground(backgroundColor)
    ? 'rgba(0,0,0,0.35)'
    : 'rgba(255,255,255,0.35)';
  const brandSize = 20;
  const urlSize = 11;
  const padding = 20;
  const lineGap = 4;
  const urlY = h - padding;
  const brandY = urlY - urlSize - lineGap;
  const rightX = w - padding;
  // Monospace at 20px ≈ 12px advance per char. Pre-measure VIZ so SCHEMA sits flush left of it.
  const tailWidth = WATERMARK_BRAND_TAIL.length * brandSize * 0.6;

  // Anchor makes the mark navigable when the SVG is opened standalone or embedded.
  // <title> surfaces as hover tooltip and is read by search crawlers indexing SVG.
  const watermark =
    `<a xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `xlink:href="${WATERMARK_URL}" href="${WATERMARK_URL}" ` +
    `target="_blank" rel="noopener">` +
    `<title>${WATERMARK_TITLE}</title>` +
    `<text x="${rightX}" y="${brandY}" ` +
    `font-family="'Space Mono', ui-monospace, monospace" font-size="${brandSize}" ` +
    `font-weight="700" letter-spacing="1" ` +
    `fill="${BRAND_TAIL_COLOR}" text-anchor="end">${WATERMARK_BRAND_TAIL}</text>` +
    `<text x="${rightX - tailWidth}" y="${brandY}" ` +
    `font-family="'Space Mono', ui-monospace, monospace" font-size="${brandSize}" ` +
    `font-weight="700" letter-spacing="1" ` +
    `fill="${BRAND_HEAD_COLOR}" text-anchor="end">${WATERMARK_BRAND_HEAD}</text>` +
    `<text x="${rightX}" y="${urlY}" ` +
    `font-family="'Space Mono', ui-monospace, monospace" font-size="${urlSize}" ` +
    `fill="${dimColor}" text-anchor="end">${WATERMARK_URL_TEXT}</text>` +
    `</a>`;

  const withWatermark = svgText.replace(/<\/svg>\s*$/, `${watermark}</svg>`);
  if (withWatermark === svgText) return dataUrl;
  return prefix + encodeURIComponent(withWatermark);
}

export async function exportCanvasAsImage(opts: ExportCanvasOptions): Promise<void> {
  const { format, scale = 2, node, backgroundColor } = opts;
  const filename = opts.filename ?? defaultFilename(format);

  if (!node.hasChildNodes()) {
    throw new Error('Schema is empty — add at least one table.');
  }

  const fontEmbedCSS = await htmlToImage.getFontEmbedCSS(node);

  let dataUrl: string;
  if (format === 'png') {
    dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: scale,
      backgroundColor,
      fontEmbedCSS,
      filter: noExportFilter,
      cacheBust: true,
    });
    try {
      dataUrl = await watermarkPng(dataUrl, scale, backgroundColor);
    } catch {
      // Watermark is non-critical — if it fails (e.g. CORS-tainted canvas in some
      // browser), ship the plain image rather than breaking the export.
    }
  } else {
    dataUrl = await htmlToImage.toSvg(node, {
      backgroundColor,
      fontEmbedCSS,
      filter: noExportFilter,
      cacheBust: true,
    });
    dataUrl = watermarkSvg(dataUrl, backgroundColor);
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {}, 100);
}
