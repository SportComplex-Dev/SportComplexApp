import { z } from "zod";

export const disableServiceForContingencySchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3).max(255),
});

export type DisableServiceForContingencyInput = z.infer<
  typeof disableServiceForContingencySchema
>;
