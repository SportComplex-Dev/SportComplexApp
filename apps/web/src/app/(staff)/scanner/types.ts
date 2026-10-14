import type { TicketInfo } from "@/components/scanner/consultation-result-card";

export interface VerifyResponseData {
  access: "GRANTED" | "DENIED";
  modo: "CONSULTA" | "TURNO";
  resultado: string;
  canjeado: boolean;
  isCached?: boolean;
  lecturaId?: string;
  ticket: TicketInfo;
}
