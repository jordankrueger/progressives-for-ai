import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { realityCheckSchema } from './lib/check-scale.mjs';

const realityCheck = defineCollection({
  // Headline checks live in checks/ (ids "checks/<slug>"), topic pages at the top level.
  loader: glob({ pattern: '**/*.mdx', base: './src/content/reality-check' }),
  schema: realityCheckSchema,
});

export const collections = {
  'reality-check': realityCheck,
};
