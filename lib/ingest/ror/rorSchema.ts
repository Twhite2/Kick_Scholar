import { z } from "zod";

/**
 * Lenient zod mirror of a ROR v2 organization record.
 *
 * Deliberately permissive (`.passthrough()`-style optionality, no enums on
 * `types`) because ROR is an upstream registry that adds fields between
 * monthly releases — a new key must never fail the import of 2,000 valid
 * universities. Anything this schema does not model is simply ignored.
 */

export const RorNameSchema = z.object({
  value: z.string(),
  lang: z.string().nullable().optional(),
  types: z.array(z.string()).default([]),
});

export const RorGeonamesDetailsSchema = z.object({
  country_code: z.string().nullable().optional(),
  country_name: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  country_subdivision_name: z.string().nullable().optional(),
});

export const RorLocationSchema = z.object({
  geonames_details: RorGeonamesDetailsSchema.optional(),
});

export const RorLinkSchema = z.object({
  // "website" | "wikipedia" | ...
  type: z.string(),
  value: z.string(),
});

export const RorExternalIdSchema = z.object({
  // "grid" | "isni" | "wikidata" | "fundref"
  type: z.string(),
  preferred: z.string().nullable().optional(),
  all: z.array(z.string()).default([]),
});

export const RorRecordSchema = z.object({
  id: z.string(), // "https://ror.org/05pb4em20"
  status: z.string(),
  types: z.array(z.string()).default([]),
  names: z.array(RorNameSchema).default([]),
  locations: z.array(RorLocationSchema).default([]),
  links: z.array(RorLinkSchema).default([]),
  domains: z.array(z.string()).default([]),
  established: z.number().int().nullable().optional(),
  external_ids: z.array(RorExternalIdSchema).default([]),
});

export type RorRecord = z.infer<typeof RorRecordSchema>;

export const RorApiResponseSchema = z.object({
  number_of_results: z.number().int(),
  items: z.array(RorRecordSchema),
});
