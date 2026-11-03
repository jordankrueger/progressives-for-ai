import { verdictById } from '../../lib/check-scale.mjs';
import { getChecks, checkSlug } from '../../lib/checks';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const checks = await getChecks();
  const items = checks
    .map((c) => {
      const url = `https://progressivesforai.com/checks/${checkSlug(c)}/`;
      const title = `${verdictById(c.data.verdict)?.label}: “${c.data.headline}” (${c.data.outlet})`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${c.data.published.toUTCString()}</pubDate>
      <description>${esc(c.data.bottomLine ?? '')}</description>
    </item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Headline Checks | Progressives for AI</title>
    <link>https://progressivesforai.com/checks/</link>
    <atom:link href="https://progressivesforai.com/checks/rss.xml" rel="self" type="application/rss+xml" />
    <description>AI headlines, checked.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
