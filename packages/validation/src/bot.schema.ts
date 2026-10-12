import { z } from "zod";

export const botTicketQuerySchema = z.object({
  ticketId: z.uuid(),
  signature: z.string().regex(/^[0-9a-f]{64}$/i),
});

export type BotTicketQuery = z.infer<typeof botTicketQuerySchema>;
