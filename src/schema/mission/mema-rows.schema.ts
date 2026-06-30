import { z } from 'zod';

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
