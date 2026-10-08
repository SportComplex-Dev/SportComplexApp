"use client";

import { useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeError } from "@stripe/stripe-js";
import { Button } from "@sportcomplex/ui";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type PaymentErrorCode = StripeError["code"];

export function getPaymentErrorMessage(
  code: PaymentErrorCode | undefined,
  declineCode?: string,
): string {
  if (declineCode === "insufficient_funds") {
    return "Tu tarjeta no tiene fondos suficientes. Prueba con otra tarjeta o consulta con tu banco.";
  }

  if (code === "card_declined" || declineCode) {
    return "El banco no autorizó el pago. Prueba con otra tarjeta o comunícate con tu banco.";
  }

  if (code === "expired_card") {
    return "La tarjeta está vencida. Revisa la fecha o intenta con otra tarjeta.";
  }

  if (code === "incorrect_cvc" || code === "invalid_cvc") {
    return "El código de seguridad no coincide. Revísalo e inténtalo de nuevo.";
  }

  if (code === "processing_error") {
    return "No pudimos procesar el pago en este momento. Inténtalo de nuevo en unos minutos.";
  }

  return "No se pudo completar el pago. Revisa los datos o intenta con otra tarjeta.";
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setPaymentSubmitted(false);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });

      if (error) {
        setErrorMessage(getPaymentErrorMessage(error.code, error.decline_code));
        return;
      }

      if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
        setPaymentSubmitted(true);
        return;
      }

      setErrorMessage(
        "El pago todavía no está confirmado. Espera un momento y vuelve a consultar el estado de tu reserva.",
      );
    } catch (error: unknown) {
      console.error("Error al confirmar el pago con Stripe:", error);
      setErrorMessage(
        "No pudimos procesar el pago en este momento. Inténtalo de nuevo en unos minutos.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {paymentSubmitted && (
        <p
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
        >
          Recibimos la respuesta del pago. Estamos esperando la confirmación segura del
          servidor; tu reserva aún no está confirmada.
        </p>
      )}

      <Button
        className="w-full"
        type="submit"
        disabled={!stripe || !elements || isSubmitting}
        aria-live="polite"
      >
        {isSubmitting ? "Procesando pago…" : "Pagar y confirmar reserva"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        El resultado final se confirmará mediante una notificación segura de Stripe.
      </p>
    </form>
  );
}

export function StripePaymentForm({ clientSecret }: { clientSecret: string | null }) {
  if (!publishableKey || !stripePromise) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          El formulario de pago no está disponible porque falta configurar la clave pública de
          Stripe.
        </p>
        <Button className="w-full" type="button" disabled>
          Pagar y confirmar reserva
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-foreground"
        >
          El pago estará disponible cuando el servidor cree la intención de pago para tu
          reserva. Aún no se puede iniciar un cobro desde esta pantalla.
        </p>
        <Button className="w-full" type="button" disabled>
          Pagar y confirmar reserva
        </Button>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#123e30",
            borderRadius: "10px",
            fontFamily: "var(--font-sans), sans-serif",
          },
        },
      }}
    >
      <PaymentForm />
    </Elements>
  );
}
