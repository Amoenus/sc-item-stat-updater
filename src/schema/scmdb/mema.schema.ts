import { z } from 'zod';

export const MemaTopShipSchema = z.object({
  count: z.number(),
  ship_name: z.string(),
  avg_duration: z.number().nullable(),
});
export type MemaTopShip = z.infer<typeof MemaTopShipSchema>;

export const MemaEntrySchema = z.object({
  contract_id: z.string(),
  n: z.number(),
  dur_p50: z.number().nullable(),
  dur_avg: z.number().nullable(),
  dur_min: z.number().nullable(),
  dur_max: z.number().nullable(),
  rate_p50: z.number().nullable(),
  rate_avg: z.number().nullable(),
  rate_event_p50: z.number().nullable(),
  rate_event_avg: z.number().nullable(),
  avg_diff: z.number().nullable(),
  avg_sat: z.number().nullable(),
  n_diff: z.number(),
  n_sat: z.number(),
  n_solo: z.number(),
  solo_p50: z.number().nullable(),
  solo_rate_p50: z.number().nullable(),
  n_duo: z.number(),
  duo_p50: z.number().nullable(),
  duo_rate_p50: z.number().nullable(),
  n_squad: z.number(),
  squad_p50: z.number().nullable(),
  squad_rate_p50: z.number().nullable(),
  n_large: z.number(),
  large_p50: z.number().nullable(),
  large_rate_p50: z.number().nullable(),
  n_multi: z.number(),
  multi_p50: z.number().nullable(),
  multi_rate_p50: z.number().nullable(),
  multi_rate_event_p50: z.number().nullable(),
  top_ships: z.array(MemaTopShipSchema),
  updated_at: z.string().nullable(),
  votes_up_patch: z.number(),
  votes_down_patch: z.number(),
  votes_down_7d: z.number(),
  votes_updated_at: z.string().nullable(),
});
export type MemaEntry = z.infer<typeof MemaEntrySchema>;

export const MemaCacheSchema = z.array(MemaEntrySchema);
export type MemaCache = z.infer<typeof MemaCacheSchema>;

export const MemaRowSchema = z.object({
  description_key: z.string(),
  mema_uec: z.string(),
  rate_p50: z.string(),
  dur_avg: z.string(),
  avg_diff: z.string(),
  avg_sat: z.string(),
  runs: z.string(),
});
export type MemaRowDTO = z.infer<typeof MemaRowSchema>;
