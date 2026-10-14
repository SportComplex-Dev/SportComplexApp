"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
} from "@sportcomplex/ui";

interface ManualEntryCardProps {
  showManualInput: boolean;
  setShowManualInput: React.Dispatch<React.SetStateAction<boolean>>;
  manualPayload: string;
  setManualPayload: (v: string) => void;
  manualTicketId: string;
  setManualTicketId: (v: string) => void;
  manualSignature: string;
  setManualSignature: (v: string) => void;
  consultationLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ManualEntryCard({
  showManualInput,
  setShowManualInput,
  manualPayload,
  setManualPayload,
  manualTicketId,
  setManualTicketId,
  manualSignature,
  setManualSignature,
  consultationLoading,
  onSubmit,
}: ManualEntryCardProps) {
  return (
    <Card className="border-[var(--brand-border)] bg-[var(--surface)] shadow-xs">
      <CardHeader
        className="py-3 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors rounded-t-xl"
        onClick={() => setShowManualInput((prev) => !prev)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--subtle)]">
            <Sparkles className="size-3.5 text-[#123e30] dark:text-[#c9ef75]" />
            <span>Ingreso manual / Simulación para pruebas (QA)</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {showManualInput ? "Ocultar" : "Mostrar"}
          </span>
        </div>
      </CardHeader>

      {showManualInput && (
        <CardContent className="pt-2 pb-4 space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--subtle)]">
                Payload QR completo (ej. SC1:&lt;uuid&gt;:&lt;firma&gt;)
              </label>
              <Input
                placeholder="SC1:9f0d6f4e-0000-4000-8000-0000000000ff:..."
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[var(--brand-border)]" />
              <span className="shrink mx-2 text-[10px] text-muted-foreground uppercase font-semibold">
                o por campos separados
              </span>
              <div className="flex-grow border-t border-[var(--brand-border)]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--subtle)]">
                  Código UUID del Ticket
                </label>
                <Input
                  placeholder="9f0d6f4e-0000-4000-8000-0000000000ff"
                  value={manualTicketId}
                  onChange={(e) => setManualTicketId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--subtle)]">
                  Firma HMAC (64 caracteres hex)
                </label>
                <Input
                  placeholder="64 caracteres hexadecimales"
                  value={manualSignature}
                  onChange={(e) => setManualSignature(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={consultationLoading}
              className="w-full text-xs"
            >
              {consultationLoading ? "Consultando..." : "Consultar Tiquete"}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
