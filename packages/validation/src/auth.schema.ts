import { z } from "zod";

// RF-01/RF-02 — credenciales y activación
export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  nombre: z.string().min(1).max(120),
});

export const resendSchema = z.object({
  email: z.email(),
});

export const verifySchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ResendInput = z.infer<typeof resendSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;