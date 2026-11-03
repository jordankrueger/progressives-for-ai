import type { APIRoute } from 'astro';
import { renderCard } from '../../../lib/og-card';
import { getChecks, checkSlug, formatDate, type Check } from '../../../lib/checks';

export async function getStaticPaths() {
  const checks = await getChecks();
  return checks.map((entry) => ({ params: { slug: checkSlug(entry) }, props: { entry } }));
}

export const GET: APIRoute = async ({ props }) => {
  const d = (props as { entry: Check }).entry.data;
  const png = await renderCard({
    headline: d.headline!,
    outlet: d.outlet!,
    date: formatDate(d.publishedDate!),
    verdict: d.verdict!,
    bottomLine: d.bottomLine!,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
