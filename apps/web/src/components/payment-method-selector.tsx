"use client";

import { useEffect, useState } from "react";
import { CreditCard, Landmark, QrCode, Store } from "lucide-react";
import { StripePaymentForm } from "@/components/stripe-payment-form";

type PaymentMethod = "card" | "pse" | "nequi" | "onsite";
type PaymentIntentState = {
  reservationId: string;
  retryCount: number;
  clientSecret?: string;
  status?: string;
  error?: string;
};

function isPaymentIntentResponse(
  value: unknown,
): value is {
  success: true;
  data: { clientSecret: string | null; status: string };
} {
  if (typeof value !== "object" || value === null) return false;
  const data = (value as { data?: unknown }).data;
  return (
    (value as { success?: unknown }).success === true &&
    typeof data === "object" &&
    data !== null &&
    ((data as { clientSecret?: unknown }).clientSecret === null ||
      typeof (data as { clientSecret?: unknown }).clientSecret === "string") &&
    typeof (data as { status?: unknown }).status === "string"
  );
}

function getApiErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

const paymentMethods: {
  id: PaymentMethod;
  label: string;
  Icon: typeof CreditCard;
}[] = [
  { id: "card", label: "Tarjeta", Icon: CreditCard },
  { id: "pse", label: "PSE / Banco", Icon: Landmark },
  { id: "nequi", label: "Nequi / QR", Icon: QrCode },
  { id: "onsite", label: "En sede", Icon: Store },
];

export function PaymentMethodSelector({ reservationId }: { reservationId: string | null }) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentState | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (reservationId === null) return;
    const activeReservationId: string = reservationId;

    const controller = new AbortController();
    async function preparePayment() {
      try {
        const response = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: activeReservationId }),
          signal: controller.signal,
        });
        const result: unknown = await response.json();

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(result) ?? "No pudimos preparar el pago. Inténtalo de nuevo.",
          );
        }
        if (!isPaymentIntentResponse(result)) {
          throw new Error("El servidor devolvió una respuesta de pago no válida.");
        }

        setPaymentIntent({
          reservationId: activeReservationId,
          retryCount,
          clientSecret: result.data.clientSecret ?? undefined,
          status: result.data.status,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setPaymentIntent({
          reservationId: activeReservationId,
          retryCount,
          error:
            error instanceof Error
              ? error.message
              : "No pudimos preparar el pago. Inténtalo de nuevo.",
        });
      }
    }

    void preparePayment();
    return () => controller.abort();
  }, [reservationId, retryCount]);

  const currentIntent =
    paymentIntent?.reservationId === reservationId && paymentIntent.retryCount === retryCount
      ? paymentIntent
      : null;

  return (
    <>
      <div
        aria-label="Medio de pago"
        className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="tablist"
      >
        {paymentMethods.map(({ id, label, Icon }) => {
          const selected = paymentMethod === id;
          return (
            <button
              key={id}
              id={`payment-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`payment-panel-${id}`}
              onClick={() => setPaymentMethod(id)}
              className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                selected
                  ? "border-[#123e30] text-[#123e30] ring-1 ring-[#123e30] dark:border-[#b8dc83] dark:text-[#d9f29f] dark:ring-[#b8dc83]"
                  : "border-[#e1e6df] text-[#526058] hover:border-[#9eafa1] dark:border-[#26352d] dark:text-[#b0beb6] dark:hover:border-[#53685a]"
              }`}
              style={{ backgroundColor: "var(--surface)" }}
            >
              <Icon aria-hidden="true" className="size-[1.1rem]" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        id={`payment-panel-${paymentMethod}`}
        role="tabpanel"
        aria-labelledby={`payment-tab-${paymentMethod}`}
        className="rounded-2xl border border-[#e1e6df] bg-white p-5 shadow-[0_8px_28px_rgba(18,38,29,0.04)] dark:border-[#26352d] dark:bg-[#141d18] dark:shadow-black/20 sm:p-6"
      >
        {paymentMethod === "card" ? (
          <>
            <h2 className="mb-1 text-base font-semibold">Pago con tarjeta</h2>
            <p className="mb-5 text-xs leading-5 text-[#68746c] dark:text-[#b0beb6]">
              Tus datos de tarjeta se ingresan directamente en Stripe y no se guardan en
              SportComplex.
            </p>
            {!reservationId ? (
              <p
                role="status"
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6"
              >
                Primero selecciona el servicio y el horario para preparar el pago de tu reserva.
              </p>
            ) : currentIntent?.error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-700 dark:text-red-300"
              >
                <p>{currentIntent.error}</p>
                <button
                  type="button"
                  className="mt-3 font-semibold underline"
                  onClick={() => setRetryCount((count) => count + 1)}
                >
                  Reintentar
                </button>
              </div>
            ) : currentIntent?.status === "succeeded" || currentIntent?.status === "processing" ? (
              <p
                role="status"
                className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-6"
              >
                Recibimos la respuesta del pago. Espera la confirmación segura del servidor; tu
                reserva aún no está confirmada.
              </p>
            ) : currentIntent?.clientSecret ? (
              <StripePaymentForm clientSecret={currentIntent.clientSecret} />
            ) : (
              <p role="status" className="rounded-xl border border-[#e1e6df] p-4 text-sm">
                Preparando el pago seguro de tu reserva…
              </p>
            )}
          </>
        ) : (
          <UnavailablePaymentMethod method={paymentMethod} />
        )}
      </div>
    </>
  );
}

function UnavailablePaymentMethod({ method }: { method: Exclude<PaymentMethod, "card"> }) {
  const messages: Record<typeof method, { heading: string; description: string }> = {
    pse: {
      heading: "PSE / Banco",
      description:
        "Este método aparecerá disponible cuando se habilite en Stripe y el servidor cree la intención de pago con soporte para PSE.",
    },
    nequi: {
      heading: "Nequi / QR",
      description:
        "Este método aparecerá disponible cuando se habilite en Stripe y el servidor cree la intención de pago correspondiente.",
    },
    onsite: {
      heading: "Pago en sede con Stripe POS",
      description:
        "El pago presencial debe procesarse desde el POS con Stripe. Esta opción no acepta efectivo y requiere que el flujo de POS esté conectado.",
    },
  };

  return (
    <div className="rounded-xl border border-[#e7ebe5] bg-[#f7f8f5] p-4 dark:border-[#26352d] dark:bg-[#1c2721]">
      <h2 className="text-sm font-semibold">{messages[method].heading}</h2>
      <p className="mt-2 text-sm leading-6 text-[#68746c] dark:text-[#b0beb6]">
        {messages[method].description}
      </p>
      <p className="mt-3 text-xs font-medium text-[#78837b] dark:text-[#829387]">
        Aún no disponible en este flujo
      </p>
    </div>
  );
}
