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

// Frontmatter fields only a headline check carries (category: headline).
export const headlineFields = {
  headline: z.string().min(1),
  outlet: z.string().min(1),
  url: z.url(),
  publishedDate: z.coerce.date(),
  verdict: z.enum(VERDICT_IDS),
  sourceType: z.enum(SOURCE_TYPE_IDS),
  topicPage: z.string().min(1), // id of a Reality Check topic page, e.g. "water"
  trackerPrediction: z.url().optional(), // aiprogresstracker.com link
  bottomLine: z.string().min(1),
  shortVersion: z.array(z.string().min(1)).length(3),
  shareReply: z.string().min(1),
};

// Sightings live on the orphan branch `headline-data` (see docs/headline-checks/data-branch/):
// sightings/YYYY-MM-DD.json is an array of these, one row per place a claim was seen.
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
export const CANDIDATE_STATUSES = ['candidate', 'researching', 'drafted', 'published', 'dropped'];
export const sightingSchema = z.strictObject({
  headline: z.string().min(1), // as published
  outlet: z.string().min(1), // who published the story
  url: z.url(), // the story itself
  where: z.string().min(1), // "r/technology" or an outlet/aggregator name
  discussionUrl: z.url().optional(), // the thread or listing where it was seen
  dateSeen: isoDay,
  upvotes: z.number().int().nonnegative().optional(), // only if visible in search results
  comments: z.number().int().nonnegative().optional(),
  claimId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case claim key'), // same claim = same id across days
  claim: z.string().optional(), // the claim pinned in one sentence
  notes: z.string().optional(),
  status: z.enum(CANDIDATE_STATUSES).default('candidate'),
});
export const sightingsFileSchema = z.array(sightingSchema);
