import { z } from 'zod';

export const TaxonomyTermSchema = z.object({
  name: z.string(),
  url: z.string(),
});

export const PropertySchema = z.object({
  id: z.string(),
  url: z.string().url(),
  slug: z.string(),
  title: z.string(),
  operation: z.enum(['sale', 'rent', 'other']).nullable(),
  property_type: z.string().nullable(),
  price: z.number().nullable(),
  price_currency: z.string().nullable(),
  price_text: z.string(),
  description: z.string(),
  location: z.object({
    name: z.string().nullable(),
    url: z.string().nullable(),
  }),
  address: z.string().nullable(),
  attributes: z
    .object({
      area_m2: z.number().nullable(),
      lot_size_m2: z.number().nullable(),
      bedrooms: z.number().nullable(),
      bathrooms: z.number().nullable(),
      year_built: z.number().nullable(),
    })
    .partial(),
  raw_details: z.record(z.string()),
  features: z.array(z.string()),
  images: z.array(z.string().url()),
  image_main: z.string().url().nullable(),
  taxonomies: z.object({
    location: z.array(TaxonomyTermSchema),
    listing_type: z.array(TaxonomyTermSchema),
    feature: z.array(TaxonomyTermSchema),
  }),
  published_at: z.string().nullable(),
  modified_at: z.string().nullable(),
  scraped_at: z.string(),
});

export type Property = z.infer<typeof PropertySchema>;
export type TaxonomyTerm = z.infer<typeof TaxonomyTermSchema>;
