import { auth } from "@/auth";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ reservationId?: string | string[] }>;
}) {
  const session = await auth();
  const { reservationId: requestedReservationId } = await searchParams;
  const reservationId =
    typeof requestedReservationId === "string" ? requestedReservationId : null;
  const customerName = session?.user?.name ?? "";
  const customerEmail = session?.user?.email ?? "";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8f5] px-4 py-8 text-[#17231c] dark:bg-[#0b120f] dark:text-[#f2f5f1] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <a
          href="/portal"
          className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-[#526058] transition hover:text-[#123e30] dark:text-[#b0beb6] dark:hover:text-[#d9f29f]"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a mis reservas
        </a>

        <ol aria-label="Progreso de reserva" className="mb-8 flex max-w-lg items-center">
          <li className="flex items-center gap-2 text-sm font-medium text-[#527c47] dark:text-[#b8dc83]">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#e8f1df] dark:bg-[#293923]">
              <Check aria-hidden="true" className="size-4" />
            </span>
            <span>Experiencia</span>
          </li>
          <li aria-hidden="true" className="mx-3 h-px flex-1 bg-[#dce2d8] dark:bg-[#26352d]" />
          <li
            aria-current="step"
            className="flex items-center gap-2 text-sm font-semibold text-[#123e30] dark:text-[#d9f29f]"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-[#123e30] text-xs text-white">
              2
            </span>
            <span>Pago</span>
          </li>
          <li aria-hidden="true" className="mx-3 h-px flex-1 bg-[#dce2d8] dark:bg-[#26352d]" />
          <li className="flex items-center gap-2 text-sm text-[#78837b] dark:text-[#829387]">
            <span className="flex size-6 items-center justify-center rounded-full border border-[#dce2d8] text-xs dark:border-[#26352d]">
              3
            </span>
            <span>Confirmación</span>
          </li>
        </ol>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <div className="mb-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.17em] text-[#527c47] dark:text-[#b8dc83]">
                Pasarela de pago segura
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
                Elige tu medio de pago.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#68746c] dark:text-[#b0beb6]">
                Selecciona cómo quieres pagar. Los pagos en línea se procesan de forma segura;
                el pago en sede se realiza con Stripe POS.
              </p>
            </div>

            <PaymentMethodSelector reservationId={reservationId} />

            <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#68746c] dark:text-[#b0beb6]">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#527c47] dark:text-[#b8dc83]"
              />
              <p>
                Tu pago se procesa de forma segura. La reserva se confirma únicamente cuando
                el servidor valida el pago.
              </p>
            </div>

            <div className="mt-7 border-t border-[#e1e6df] pt-5 dark:border-[#26352d]">
              <div className="mb-3 flex items-center gap-2">
                <UserRound
                  aria-hidden="true"
                  className="size-4 text-[#527c47] dark:text-[#b8dc83]"
                />
                <h2 className="text-sm font-semibold">Datos de tu cuenta</h2>
              </div>
              <div className="grid gap-3 rounded-xl border border-[#e1e6df] bg-white p-4 text-sm dark:border-[#26352d] dark:bg-[#141d18] sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#78837b] dark:text-[#829387]">Nombre</p>
                  <p className="mt-1 font-medium">
                    {customerName || "No registrado en tu perfil"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78837b] dark:text-[#829387]">
                    Correo electrónico
                  </p>
                  <p className="mt-1 break-all font-medium">
                    {customerEmail || "No registrado en tu perfil"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#78837b] dark:text-[#829387]">
                Estos datos corresponden a la sesión iniciada. Para actualizarlos, edita tu
                perfil.
              </p>
            </div>
          </section>

          <aside className="rounded-2xl border border-[#e1e6df] bg-white p-5 shadow-[0_8px_28px_rgba(18,38,29,0.04)] dark:border-[#26352d] dark:bg-[#141d18] dark:shadow-black/20 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#68746c] dark:text-[#b0beb6]">
              Resumen de compra
            </p>
            <h2 className="mt-2 text-sm font-semibold">Tu reserva</h2>

            <div className="my-5 rounded-xl bg-[#f4f7f1] p-4 dark:bg-[#1c2721]">
              <p className="text-sm font-medium">
                Aún no has seleccionado una experiencia
              </p>
              <p className="mt-1 text-xs leading-5 text-[#68746c] dark:text-[#b0beb6]">
                Vuelve a la selección de servicios para elegir el lugar y horario de tu
                reserva.
              </p>
            </div>

            <div className="space-y-3 border-b border-[#e7ebe5] pb-5 text-xs text-[#68746c] dark:border-[#26352d] dark:text-[#b0beb6]">
              <p className="flex items-center gap-2">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 text-[#527c47] dark:text-[#b8dc83]"
                />
                Fecha pendiente de selección
              </p>
              <p className="flex items-center gap-2">
                <Clock3
                  aria-hidden="true"
                  className="size-4 text-[#527c47] dark:text-[#b8dc83]"
                />
                Horario pendiente de selección
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm font-semibold">Total a pagar</span>
              <span className="text-sm font-semibold text-[#78837b] dark:text-[#829387]">
                Pendiente
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#78837b] dark:text-[#829387]">
              El total se calculará al seleccionar el servicio y la disponibilidad.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
