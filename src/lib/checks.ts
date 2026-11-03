import { getCollection, type CollectionEntry } from 'astro:content';
import { VERDICTS } from './check-scale.mjs';

export type Check = CollectionEntry<'reality-check'>;

const branch = process.env.CF_PAGES_BRANCH;

// Drafts render in `astro dev`, on Cloudflare preview branches, or with SHOW_DRAFTS=1.
// A production build (main, or a local build without those) never includes them.
export const SHOW_DRAFTS =
  import.meta.env.DEV || process.env.SHOW_DRAFTS === '1' || (!!branch && branch !== 'main');

// Preview deploys point og:image at themselves so the card can be tested before launch.
export const SITE_ORIGIN =
  branch && branch !== 'main' && process.env.CF_PAGES_URL
    ? process.env.CF_PAGES_URL
    : 'https://progressivesforai.com';

// Inbox for "send us a headline" and "report a mistake". Domain uses Cloudflare Email Routing;
// confirm this address is routed before launch.
export const CHECKS_EMAIL = 'newsletter@progressivesforai.com';

export const checkSlug = (entry: Check) => entry.id.replace(/^checks\//, '');
export const checkPath = (entry: Check) => `/checks/${checkSlug(entry)}/`;

export async function getChecks(): Promise<Check[]> {
  const entries = await getCollection(
    'reality-check',
    ({ data }) => data.category === 'headline' && (SHOW_DRAFTS || data.draft !== true),
  );
  return entries.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

// "4 checked: 1 holds up, 2 overblown, 1 doesn't hold up" (zero counts left out).
export function tallyText(checks: Check[]): string {
  const parts = VERDICTS.map((v) => {
    const n = checks.filter((c) => c.data.verdict === v.id).length;
    return n ? `${n} ${n === 1 ? v.label.toLowerCase() : v.plural}` : '';
  }).filter(Boolean);
  return `${checks.length} checked${parts.length ? `: ${parts.join(', ')}` : ''}`;
}

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
