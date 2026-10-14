'use client';

import { ArrowRight, Loader2, X } from 'lucide-react';
import { Badge, Button } from '@sportcomplex/ui';
import {
  calculateCartTotal,
  formatMoney,
  type CartItem,
} from '@/app/(customer)/portal/book/cart-utils';

export interface BookingSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onProceedToPayment: () => void;
  isProcessing: boolean;
  checkoutError?: string;
}

export function BookingSummaryModal({
  isOpen,
  onClose,
  cart,
  onProceedToPayment,
  isProcessing,
  checkoutError,
}: BookingSummaryModalProps) {
  if (!isOpen) return null;

  const total = calculateCartTotal(cart);
  const activeSlot = cart[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1710]/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isProcessing) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-review-title"
        className="w-full max-w-lg rounded-2xl border border-[#e5e9e2] bg-white p-5 text-[#14251d] shadow-2xl dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#edf3ee] sm:p-6 animate-in fade-in-0 zoom-in-95 duration-200"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#63816d] dark:text-[#9eb3a1]">
              Revisión del carrito multi-servicio
            </p>
            <h2 id="booking-review-title" className="mt-1 text-xl font-bold">
              Confirma tu selección en la misma franja
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            disabled={isProcessing}
            onClick={onClose}
            aria-label="Cerrar revisión"
            className="rounded-lg p-2 text-[#68776d] transition hover:bg-[#f1f4ee] disabled:opacity-50 dark:text-[#bdc9bf] dark:hover:bg-[#26342b]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Indicador de Franja Seleccionada */}
        {activeSlot && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[#f4f6f2] px-3.5 py-2.5 text-sm font-medium text-[#59695d] dark:bg-[#222e26] dark:text-[#bdc9bf]">
            <span>{activeSlot.date}</span>
            <Badge variant="success" className="font-bold">
              {activeSlot.startTime} – {activeSlot.endTime}
            </Badge>
          </div>
        )}

        {/* Lista de Servicios a Bloquear Juntos */}
        <ul className="mt-3 max-h-60 divide-y divide-[#edf0eb] overflow-y-auto pr-1 dark:divide-[#2b3730]">
          {cart.map((item) => (
            <li
              key={item.serviceId}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.serviceName}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {item.serviceCategory}
                  </Badge>
                  <span className="text-xs text-[#758278] dark:text-[#aab8ad]">
                    1 cupo
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold">
                {formatMoney(item.price)}
              </span>
            </li>
          ))}
        </ul>

        {/* Total Consolidado */}
        <div className="mt-2 flex items-center justify-between border-t border-[#dce3da] pt-4 dark:border-[#39483e]">
          <span className="text-sm font-medium text-[#68776d] dark:text-[#aab8ad]">
            Total consolidado a pagar
          </span>
          <span className="text-xl font-bold text-[#183e30] dark:text-[#c9ef75]">
            {formatMoney(total)}
          </span>
        </div>

        {/* Alerta de Error Accesible (404 SLOT_NOT_FOUND, 409 CONFLICT, etc.) */}
        {checkoutError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {checkoutError}
          </div>
        )}

        {/* Botones de Acción */}
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            variant="accent"
            disabled={isProcessing || cart.length === 0}
            onClick={onProceedToPayment}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Procesando checkout atómico...
              </>
            ) : (
              <>
                Proceder al pago conjunto <ArrowRight size={16} />
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={onClose}
            className="w-full text-xs"
          >
            Seguir agregando servicios
          </Button>
        </div>
      </section>
    </div>
  );
}

