// Shared vocabulary for Headline Checks. Plain .mjs so the Astro build and the
// node scripts in scripts/ (checks:validate, checks:verify) read the same lists.
import { z } from 'astro/zod';

export const VERDICTS = [
  { id: 'holds-up', label: 'Holds up', color: '#1e6b4f', plural: 'hold up',
    meaning: 'The headline is accurate as written. The evidence says what it says.' },
  { id: 'mostly-holds-up', label: 'Mostly holds up', color: '#3f7d2c', plural: 'mostly hold up',
    meaning: 'The core claim is right; a detail, number or framing is off in a way that does not change the takeaway.' },
  { id: 'mixed', label: 'Mixed', color: '#a16207', plural: 'mixed',
    meaning: 'Part of the headline is supported and part is not, or the evidence points both ways.' },
  { id: 'overblown', label: 'Overblown', color: '#c2410c', plural: 'overblown',
    meaning: 'There is a real finding underneath, but the headline inflates its size, certainty or reach.' },
  { id: 'doesnt-hold-up', label: "Doesn't hold up", color: '#b91c1c', plural: "don't hold up",
    meaning: 'The evidence does not support the headline as written.' },
  { id: 'too-early', label: 'Too early to tell', color: '#475569', plural: 'too early to tell',
    meaning: 'The claim rests on evidence that is too thin or too new to judge yet. We say what would settle it.' },
  { id: 'out-of-date', label: 'Out of date', color: '#6b5b95', plural: 'out of date',
    meaning: 'It was fair when published, but newer evidence has overtaken it.' },
];
export const VERDICT_IDS = VERDICTS.map((v) => v.id);
export const verdictById = (id) => VERDICTS.find((v) => v.id === id);

export const SOURCE_TYPES = [
  { id: 'peer-reviewed', label: 'Peer-reviewed study' },
  { id: 'preprint', label: 'Preprint' },
  { id: 'industry-report', label: 'Company or industry report' },
  { id: 'survey', label: 'Survey' },
  { id: 'government-data', label: 'Government data' },
  { id: 'news-report', label: 'News report' },
  { id: 'nonprofit-report', label: 'Nonprofit report' },
  { id: 'anecdote', label: 'Anecdote' },
];
export const SOURCE_TYPE_IDS = SOURCE_TYPES.map((s) => s.id);
export const sourceTypeById = (id) => SOURCE_TYPES.find((s) => s.id === id);

// Body sections every check must have, in this order (checks:verify enforces it).
export const REQUIRED_SECTIONS = [
  'Where the claim came from',
  'What the evidence actually shows',
  'What the headline gets right',
  'What it gets wrong or leaves out',
  'Where the real concern is',
  "What we're not sure about",
];
export const OPTIONAL_SECTIONS = ['The progressive move'];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
// YAML reads an unquoted 2026-11-03 as a Date; store it as the day string either way.
const day = (inner) => z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), inner);

// --- Sources: each check's sources live in its frontmatter (`sources:`), original first.
// Every source is checked twice before publishing (Claude Haiku in the research routine,
// ChatGPT in the source-check-chatgpt workflow) and re-checked monthly through Jev.
export const MODEL_RESULTS = [
  { id: 'supports', label: 'Supports' },
  { id: 'partly', label: 'Partly supports' },
  { id: 'doesnt-support', label: "Doesn't support" },
];
export const RECHECK_STATUSES = [
  { id: 'ok', label: 'Still live and still says this' },
  { id: 'link-down', label: 'Link down' },
  { id: 'changed', label: 'No longer says this' },
  { id: 'needs-new-source', label: 'Needs a new source' },
];
const modelCheck = z.strictObject({
  date: day(isoDay),
  result: z.enum(MODEL_RESULTS.map((r) => r.id)),
  note: z.string().optional(),
  for: z.string().optional(), // sourceFingerprint() of the source when it was checked
});
const recheck = z.strictObject({
  date: day(isoDay),
  status: z.enum(RECHECK_STATUSES.map((r) => r.id)),
  jevConfidence: z.number().min(0).max(1).nullable().optional(), // null: link checked, text not read (PDF)
  httpStatus: z.number().int().optional(),
  finalUrl: z.url({ protocol: /^https?$/ }).optional(),
  note: z.string().optional(),
});
export const sourceSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().min(1),
  outlet: z.string().min(1),
  date: day(z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'use YYYY, YYYY-MM or YYYY-MM-DD')),
  type: z.enum(SOURCE_TYPE_IDS),
  isOriginal: z.boolean().default(false),
  supportsClaim: z.string().min(1), // the one claim on our page this source backs
  quote: z.string().max(400).refine((q) => (q.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3, 'quote needs real words'), // short exact quote from the source
  verification: z
    .strictObject({
      haiku: modelCheck.optional(),
      chatgpt: modelCheck.optional(),
      recheck: recheck.optional(),
      sample: z.boolean().optional(), // placeholder results on a template check
    })
    .default({}),
});

// Same text in, same id out: a model check is only valid for the url, quote and claim it read.
export function sourceFingerprint(s) {
  const str = [s.url, s.quote, s.supportsClaim].join('|');
  let h = 0x811c9dc5; // FNV-1a, 32-bit: enough to notice an edit, not a security boundary
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

// Publishing rules for a check's sources. Drafts only need the shape and the original first.
export function sourceIssues(sources, { draft }) {
  const issues = [];
  if (!sources?.length) return ['sources: at least one source is required'];
  if (!sources[0].isOriginal) issues.push('sources: the first source must be the original (isOriginal: true)');
  if (draft) return issues;
  sources.forEach((s, i) => {
    const v = s.verification ?? {};
    if (v.sample) issues.push(`sources.${i}: sample verification can't be published`);
    for (const model of ['haiku', 'chatgpt']) {
      const c = v[model];
      if (!c) issues.push(`sources.${i}: no ${model} check (every source is checked by Claude Haiku and ChatGPT)`);
      else if (c.result === 'doesnt-support') issues.push(`sources.${i}: ${model} says this source doesn't support the claim`);
      else if (!c.for) issues.push(`sources.${i}: ${model} check has no fingerprint ("for"); run npm run checks:fingerprint -- <file> --stamp haiku`);
      else if (c.for !== sourceFingerprint(s)) issues.push(`sources.${i}: ${model} check is stale (url, quote or claim changed since)`);
    }
  });
  return issues;
}

// Frontmatter fields only a headline check carries (category: headline).
export const headlineFields = {
  headline: z.string().min(1),
  outlet: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
  publishedDate: z.coerce.date(),
  verdict: z.enum(VERDICT_IDS),
  sourceType: z.enum(SOURCE_TYPE_IDS),
  topicPage: z.string().min(1), // id of a Reality Check topic page, e.g. "water"
  trackerPrediction: z.url({ protocol: /^https?$/ }).optional(), // aiprogresstracker.com link
  bottomLine: z.string().min(1),
  shortVersion: z.array(z.string().min(1)).length(3),
  shareReply: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
};

// Sightings live on the orphan branch `headline-data` (see docs/headline-checks/data-branch/):
// sightings/YYYY-MM-DD.json is an array of these, one row per place a claim was seen.
export const CANDIDATE_STATUSES = ['candidate', 'researching', 'drafted', 'published', 'dropped'];
export const sightingSchema = z.strictObject({
  headline: z.string().min(1), // as published
  outlet: z.string().min(1), // who published the story
  url: z.url({ protocol: /^https?$/ }), // the story itself
  where: z.string().min(1), // "r/technology" or an outlet/aggregator name
  discussionUrl: z.url({ protocol: /^https?$/ }).optional(), // the thread or listing where it was seen
  dateSeen: isoDay,
  upvotes: z.number().int().nonnegative().optional(), // only if visible in search results
  comments: z.number().int().nonnegative().optional(),
  claimId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case claim key'), // same claim = same id across days
  claim: z.string().optional(), // the claim pinned in one sentence
  notes: z.string().optional(),
  status: z.enum(CANDIDATE_STATUSES).default('candidate'),
});
export const sightingsFileSchema = z.array(sightingSchema);

// Drafts render in `astro dev`, on Cloudflare preview branches (CF_PAGES_BRANCH not main),
// or with SHOW_DRAFTS=1. A production build never includes them.
export function draftsVisible({ dev = false, env = {} } = {}) {
  const branch = env.CF_PAGES_BRANCH;
  if (branch === 'main') return false; // the production build never shows drafts, whatever else is set
  return Boolean(dev || env.SHOW_DRAFTS === '1' || branch);
}

// "4 checked: 1 holds up, 2 overblown, 1 doesn't hold up" (zero counts left out).
export function tallyText(verdictIds) {
  const parts = VERDICTS.map((v) => {
    const n = verdictIds.filter((id) => id === v.id).length;
    return n ? `${n} ${n === 1 ? v.label.toLowerCase() : v.plural}` : '';
  }).filter(Boolean);
  return `${verdictIds.length} checked${parts.length ? `: ${parts.join(', ')}` : ''}`;
}

// Frontmatter schema for every Reality Check entry. Headline checks (category: headline)
// must also carry all headlineFields. Shared by content.config.ts and scripts/checks/.
export const realityCheckSchema = z
  .object({
    title: z.string(),
    dek: z.string(),
    category: z.enum(['myth', 'guide', 'tracker', 'headline']),
    topic: z.string(),
    published: z.date(),
    updated: z.date(),
    changelog: z.array(z.object({ date: z.string(), note: z.string() })),
    readingTime: z.number().optional(),
    sourceCount: z.number().optional(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  })
  .extend(z.object(headlineFields).partial().shape)
  .superRefine((data, ctx) => {
    if (data.category !== 'headline') return;
    const parsed = z.object(headlineFields).safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, message: `headline check: ${issue.message}` });
      return;
    }
    for (const message of sourceIssues(parsed.data.sources, { draft: data.draft })) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message });
    }
  });
