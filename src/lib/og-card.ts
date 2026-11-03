// Build-time 1200x630 verdict card: satori lays out text as SVG paths, sharp rasterizes.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { verdictById } from './check-scale.mjs';

// cwd-relative: this module is bundled into dist/ at build time, so import.meta.url moves.
const font = (w: number) => readFile(join(process.cwd(), 'src/assets/fonts', `inter-latin-${w}.woff`));
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: 'normal' }[]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all([400, 700, 800].map(async (w) => ({ name: 'Inter', data: await font(w), weight: w as 400 | 700 | 800, style: 'normal' as const }))));

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

export type CardInput = { headline: string; outlet: string; date: string; verdict: string; bottomLine: string };

export async function renderCard({ headline, outlet, date, verdict, bottomLine }: CardInput): Promise<Buffer> {
  const v = verdictById(verdict);
  if (!v) throw new Error(`unknown verdict "${verdict}"`);
  const size = headline.length > 130 ? 40 : headline.length > 90 ? 48 : 58;
  // satori boxes are content-box: the outer div is exactly 1200x630, the inner one carries the margins.
  const tree = el('div', { width: 1200, height: 630, display: 'flex', background: '#ffffff', fontFamily: 'Inter', color: '#1a1a2e' }, [el('div', { width: 1072, height: 504, marginTop: 70, marginLeft: 64, display: 'flex', flexDirection: 'column' }, [
    el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: '#1e6b4f' }, [
      el('span', {}, 'HEADLINE CHECK'),
      el('span', { color: '#4a5568', letterSpacing: 0 }, 'Progressives for AI'),
    ]),
    el('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, [
      el('div', { fontSize: size, fontWeight: 800, lineHeight: 1.15 }, `“${headline}”`),
      el('div', { fontSize: 24, color: '#4a5568', marginTop: 18 }, `${outlet} · ${date}`),
    ]),
    el('div', { display: 'flex', alignItems: 'center', gap: 24 }, [
      el('div', { display: 'flex', background: v.color, color: '#ffffff', fontSize: 30, fontWeight: 800, padding: '12px 26px', borderRadius: 999, flexShrink: 0 }, v.label),
      el('div', { width: 780, fontSize: bottomLine.length > 150 ? 21 : 24, lineHeight: 1.35, color: '#1a1a2e' }, bottomLine),
    ]),
    el('div', { display: 'flex', marginTop: 24, fontSize: 20, color: '#4a5568' }, 'progressivesforai.com/checks · AI headlines, checked'),
  ]), el('div', { position: 'absolute', top: 0, left: 0, width: 1200, height: 14, background: v.color }, '')]);
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts: await loadFonts() });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
