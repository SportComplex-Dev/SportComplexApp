import { z } from "zod";

export const posPaymentIntentSchema = z.object({
  reservaId: z.uuid(),
});

export type PosPaymentIntentRequest = z.infer<typeof posPaymentIntentSchema>;
