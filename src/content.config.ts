import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const realityCheck = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/reality-check' }),
  schema: z.object({
    title: z.string(),
    dek: z.string(),
    category: z.enum(['myth', 'guide', 'tracker']),
    topic: z.string(),
    published: z.date(),
    updated: z.date(),
    changelog: z.array(
      z.object({
        date: z.string(),
        note: z.string(),
      }),
    ),
    readingTime: z.number().optional(),
    sourceCount: z.number().optional(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  'reality-check': realityCheck,
};
