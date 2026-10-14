'use client';

import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { Badge, Button } from '@sportcomplex/ui';
import {
  calculateCartTotal,
  formatMoney,
  type CartItem,
} from '@/app/(customer)/portal/book/cart-utils';

export interface CartProps {
  cart: CartItem[];
  onRemoveService: (serviceId: string) => void;
  onClearCart: () => void;
  onReviewSelection: () => void;
  feedbackMessage?: string;
}

export function Cart({
  cart,
  onRemoveService,
  onClearCart,
  onReviewSelection,
  feedbackMessage,
}: CartProps) {
  const shouldReduceMotion = useReducedMotion();
  const total = calculateCartTotal(cart);
  const activeSlot = cart[0];

  return (
    <aside aria-label="Carrito de servicios" className="lg:sticky lg:top-[88px]">
      <div className="overflow-hidden rounded-2xl border border-[#e5e9e2] bg-white shadow-sm dark:border-[#2b3730] dark:bg-[#19231d]">
        {/* Cabecera del Carrito */}
        <div className="flex items-center justify-between bg-[#183e30] px-5 py-4 text-white dark:bg-[#20372a]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c9ef75]">
              Tu selección multi-servicio
            </p>
            <h2 className="mt-1 text-lg font-bold">Carrito de reserva</h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
            <ShoppingBag size={19} />
          </span>
        </div>

        <div className="p-4">
          {cart.length === 0 ? (
            <div className="py-6 text-center">
              <p className="font-semibold text-[#334a3a] dark:text-[#d4dfd5]">
                Tu plan empieza aquí
              </p>
              <p className="mx-auto mt-1 max-w-[240px] text-xs leading-5 text-[#7a877e] dark:text-[#aab8ad]">
                Elige una franja horaria y agrega múltiples servicios distintos para reservarlos juntos.
              </p>
            </div>
          ) : (
            <>
              {/* Resumen de cantidad y botón Vaciar */}
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#334a3a] dark:text-[#d4dfd5]">
                  {cart.length} {cart.length === 1 ? 'servicio agregado' : 'servicios en la misma franja'}
                </span>
                <button
                  type="button"
                  onClick={onClearCart}
                  className="font-semibold text-[#728077] hover:text-red-700 dark:text-[#aab8ad] dark:hover:text-red-400"
                >
                  Vaciar carrito
                </button>
              </div>

              {/* Indicador de Franja Común */}
              {activeSlot && (
                <div className="mb-3 rounded-lg bg-[#f4f6f2] px-3 py-2 text-xs font-medium text-[#59695d] dark:bg-[#222e26] dark:text-[#bdc9bf] flex items-center justify-between">
                  <span>{activeSlot.date}</span>
                  <Badge variant="success" className="text-[11px] font-bold">
                    {activeSlot.startTime} – {activeSlot.endTime}
                  </Badge>
                </div>
              )}

              {/* Lista de Servicios con Transición Suave */}
              <ul className="divide-y divide-[#edf0eb] dark:divide-[#2b3730]">
                <AnimatePresence initial={false}>
                  {cart.map((item) => (
                    <motion.li
                      key={item.serviceId}
                      layout={!shouldReduceMotion}
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto', y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-start justify-between gap-2 py-2.5 overflow-hidden"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-xs font-bold text-[#203329] dark:text-[#e1e9e2]">
                          {item.serviceName}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {item.serviceCategory}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.startTime} – {item.endTime}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-bold text-[#244533] dark:text-[#dce8dd]">
                          {formatMoney(item.price)}
                        </span>
                        <motion.button
                          type="button"
                          whileHover={shouldReduceMotion ? undefined : { scale: 1.15 }}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                          onClick={() => onRemoveService(item.serviceId)}
                          aria-label={`Quitar ${item.serviceName} del carrito`}
                          className="rounded-md p-1.5 text-[#9a6962] transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-[#3a2927]"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              {/* Total y Acción */}
              <div className="mt-3 border-t border-dashed border-[#dce3da] pt-3 dark:border-[#39483e]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#68776d] dark:text-[#aab8ad]">
                    Total consolidado
                  </span>
                  <span className="text-lg font-bold text-[#183e30] dark:text-[#c9ef75]">
                    {formatMoney(total)}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="accent"
                  disabled={cart.length === 0}
                  onClick={onReviewSelection}
                  className="mt-3 w-full"
                >
                  Revisar selección <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] leading-4 text-[#849087] dark:text-[#96a49a]">
        Armar el carrito no bloquea cupos ni crea reservas hasta que inicies el proceso de pago.
      </p>

      {/* Notificación de feedback accesible */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-xl border border-[#dce9cb] bg-[#f0f7e5] px-4 py-3 text-xs leading-5 text-[#38583a] dark:border-[#3a4c38] dark:bg-[#202d22] dark:text-[#d3e4c5]"
        >
          {feedbackMessage}
        </div>
      )}
    </aside>
  );
}

