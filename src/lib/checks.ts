import { getCollection, type CollectionEntry } from 'astro:content';
import { draftsVisible, tallyText as tallyIds } from './check-scale.mjs';

export type Check = CollectionEntry<'reality-check'>;

const branch = process.env.CF_PAGES_BRANCH;

export const SHOW_DRAFTS = draftsVisible({ dev: import.meta.env.DEV, env: process.env });

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

export const tallyText = (checks: Check[]) => tallyIds(checks.map((c) => c.data.verdict as string));

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
