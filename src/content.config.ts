import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { headlineFields } from './lib/check-scale.mjs';

const realityCheck = defineCollection({
  // Headline checks live in checks/ (ids "checks/<slug>"), topic pages at the top level.
  loader: glob({ pattern: '**/*.mdx', base: './src/content/reality-check' }),
  schema: z
    .object({
      title: z.string(),
      dek: z.string(),
      category: z.enum(['myth', 'guide', 'tracker', 'headline']),
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
    })
    .extend(z.object(headlineFields).partial().shape)
    .superRefine((data, ctx) => {
      if (data.category !== 'headline') return;
      const parsed = z.object(headlineFields).safeParse(data);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, message: `headline check: ${issue.message}` });
      }
    }),
});

export const collections = {
  'reality-check': realityCheck,
};
