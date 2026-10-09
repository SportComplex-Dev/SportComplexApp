"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Clock3, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { categoryBySlug, initialCatalog, serviceCategories } from "@sportcomplex/core/src/domain/catalog";
import type { CategorySlug } from "@sportcomplex/core/src/domain/catalog";

interface CartService {
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  startTime: string;
  endTime: string;
  price: number;
}

const services = initialCatalog.filter((service) => service.status === "Disponible");
const timeSlots = [
  { startTime: "09:00", endTime: "10:00" },
  { startTime: "10:00", endTime: "11:00" },
  { startTime: "17:00", endTime: "18:00" },
];

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

function getBogotaDateAfter(days: number): string {
  const now = new Date();
  const bogotaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = bogotaDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

export default function BookPage() {
  const [date, setDate] = useState(() => getBogotaDateAfter(0));
  const [selectedSlot, setSelectedSlot] = useState<(typeof timeSlots)[number] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | "todos">("todos");
  const [cart, setCart] = useState<CartService[]>([]);
  const [message, setMessage] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  const visibleServices = useMemo(
    () =>
      selectedCategory === "todos"
        ? services
        : services.filter((service) => service.category === selectedCategory),
    [selectedCategory],
  );
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);

  function chooseSlot(slot: (typeof timeSlots)[number]) {
    if (
      cart.length > 0 &&
      (selectedSlot?.startTime !== slot.startTime || selectedSlot.endTime !== slot.endTime)
    ) {
      setMessage("Vacía el carrito antes de cambiar de horario para mantener los servicios en la misma franja.");
      return;
    }
    setSelectedSlot(slot);
    setMessage("");
  }

  function addService(service: (typeof services)[number]) {
    if (!selectedSlot) {
      setMessage("Primero selecciona una franja horaria.");
      return;
    }
    if (cart.some((item) => item.serviceId === service.id)) {
      setMessage(`${service.name} ya está en tu carrito.`);
      return;
    }
    setCart((items) => [
      ...items,
      {
        serviceId: service.id,
        serviceName: service.name,
        serviceCategory: categoryBySlug(service.category)?.name ?? "Servicio",
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        price: service.price,
      },
    ]);
    setMessage("");
  }

  function removeService(serviceId: string) {
    setCart((items) => items.filter((item) => item.serviceId !== serviceId));
    setMessage("");
  }

  function clearCart() {
    setCart([]);
    setSelectedSlot(null);
    setMessage("");
  }

  function reviewSelection() {
    if (cart.length === 0) {
      setMessage("Agrega al menos un servicio antes de revisar la selección.");
      return;
    }
    setReviewOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#14251d] transition-colors dark:bg-[#111815] dark:text-[#edf3ee]">
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <header className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-[#123e30] px-6 py-6 text-white shadow-lg sm:px-8">
          <div aria-hidden="true" className="absolute -right-8 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5" />
          <div className="relative max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c9ef75]">Reserva tu próximo plan</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Elige tu espacio. <span className="text-[#c9ef75]">Arma tu plan.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-white/75">
              Selecciona una fecha y franja; después combina los servicios que quieras en el mismo horario.
            </p>
          </div>
        </header>

        <div className="mb-5 rounded-xl border border-[#dce9cb] bg-[#f0f7e5] px-4 py-3 text-sm leading-5 text-[#38583a] dark:border-[#3a4c38] dark:bg-[#202d22] dark:text-[#d3e4c5]">
          Vista frontend con catálogo y franjas de muestra. La disponibilidad real y el pago se conectarán al completar TSK-BE-12. Agregar servicios no bloquea cupos.
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-label="Selección de servicios" className="min-w-0">
            <div className="mb-4 rounded-2xl border border-[#e5e9e2] bg-white p-4 shadow-sm dark:border-[#2b3730] dark:bg-[#19231d] sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#63816d] dark:text-[#9eb3a1]">Paso 1 · Fecha y horario</p>
                  <h2 className="mt-1 text-lg font-bold">¿Cuándo quieres venir?</h2>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-[#43574b] dark:text-[#c7d2c9]">
                  Fecha
                  <input
                    type="date"
                    min={getBogotaDateAfter(0)}
                    max={getBogotaDateAfter(15)}
                    value={date}
                    disabled={cart.length > 0}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setMessage("");
                    }}
                    className="rounded-lg border border-[#dce3da] bg-white px-3 py-2 text-sm text-[#14251d] outline-none focus:border-[#1d6048] focus:ring-2 focus:ring-[#1d6048]/15 disabled:bg-[#f3f5f1] dark:border-[#39483e] dark:bg-[#202d25] dark:text-white dark:disabled:bg-[#29342c]"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {timeSlots.map((slot) => {
                  const active = selectedSlot?.startTime === slot.startTime;
                  const blocked = cart.length > 0 && !active;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      aria-pressed={active}
                      disabled={blocked}
                      onClick={() => chooseSlot(slot)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                        active
                          ? "border-[#1d6048] bg-[#edf5e2] text-[#214d36] dark:border-[#7ca657] dark:bg-[#2c3c2a] dark:text-[#d8efb3]"
                          : blocked
                            ? "cursor-not-allowed border-[#edf0eb] bg-[#f7f8f6] text-[#a0aaa2] dark:border-[#303b33] dark:bg-[#202722] dark:text-[#68756b]"
                            : "border-[#dce4da] bg-white text-[#354b3b] hover:border-[#72947a] hover:bg-[#f7faf4] dark:border-[#39483e] dark:bg-[#202d25] dark:text-[#d4dfd5] dark:hover:bg-[#28362c]"
                      }`}
                    >
                      <Clock3 size={15} />
                      {slot.startTime} – {slot.endTime}
                      {active && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
              {cart.length > 0 && (
                <button type="button" onClick={clearCart} className="mt-3 text-xs font-semibold text-[#64776a] underline underline-offset-2 hover:text-[#183e30] dark:text-[#b9c8ba] dark:hover:text-white">
                  Vaciar carrito para cambiar horario o fecha
                </button>
              )}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#63816d] dark:text-[#9eb3a1]">Paso 2 · Servicios</p>
                <h2 className="mt-0.5 text-lg font-bold">Agrega a tu plan</h2>
              </div>
              <span className="text-xs text-[#728077] dark:text-[#aab8ad]">{visibleServices.length} opciones</span>
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por categoría">
              <button
                type="button"
                aria-pressed={selectedCategory === "todos"}
                onClick={() => setSelectedCategory("todos")}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${selectedCategory === "todos" ? "bg-[#183e30] text-white dark:bg-[#c9ef75] dark:text-[#19352a]" : "border border-[#e0e6df] bg-white text-[#526058] hover:bg-[#f1f4ee] dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#c2cec4] dark:hover:bg-[#26342b]"}`}
              >
                Todos
              </button>
              {serviceCategories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  aria-pressed={selectedCategory === category.slug}
                  onClick={() => setSelectedCategory(category.slug)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${selectedCategory === category.slug ? "bg-[#183e30] text-white dark:bg-[#c9ef75] dark:text-[#19352a]" : "border border-[#e0e6df] bg-white text-[#526058] hover:bg-[#f1f4ee] dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#c2cec4] dark:hover:bg-[#26342b]"}`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {visibleServices.map((service, index) => {
                const inCart = cart.some((item) => item.serviceId === service.id);
                const color = ["#eaf2d9", "#e4f1f3", "#faeee1", "#eeeafa"][index % 4];
                return (
                  <article key={service.id} className="flex min-h-[168px] flex-col justify-between rounded-2xl border border-[#e5e9e2] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#2b3730] dark:bg-[#19231d]">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold text-[#244b37]" style={{ backgroundColor: color }}>
                            {service.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#63816d] dark:text-[#9eb3a1]">
                              {categoryBySlug(service.category)?.name ?? "Servicio"}
                            </p>
                            <h3 className="mt-0.5 line-clamp-1 text-sm font-bold text-[#18291f] dark:text-[#edf3ee]">{service.name}</h3>
                          </div>
                        </div>
                        {inCart && <Check size={17} className="shrink-0 text-[#446b36] dark:text-[#c9ef75]" />}
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-4 text-[#68776d] dark:text-[#aab8ad]">
                        {service.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#edf0eb] pt-3 dark:border-[#2b3730]">
                      <span className="text-sm font-bold text-[#183c2e] dark:text-[#dce8dd]">{formatMoney(service.price)}</span>
                      <button
                        type="button"
                        disabled={!selectedSlot || inCart}
                        onClick={() => addService(service)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5e2] px-3 py-2 text-xs font-bold text-[#31563a] transition hover:bg-[#e1efce] disabled:cursor-not-allowed disabled:bg-[#f1f3ef] disabled:text-[#9aa49c] dark:bg-[#2b3b2a] dark:text-[#d8efb3] dark:hover:bg-[#354a32] dark:disabled:bg-[#252d27] dark:disabled:text-[#758078]"
                      >
                        {inCart ? "Agregado" : <><Plus size={14} /> Agregar</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside aria-label="Carrito de servicios" className="lg:sticky lg:top-[88px]">
            <div className="overflow-hidden rounded-2xl border border-[#e5e9e2] bg-white shadow-sm dark:border-[#2b3730] dark:bg-[#19231d]">
              <div className="flex items-center justify-between bg-[#183e30] px-5 py-4 text-white dark:bg-[#20372a]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c9ef75]">Tu selección</p>
                  <h2 className="mt-1 text-lg font-bold">Carrito</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
                  <ShoppingBag size={19} />
                </span>
              </div>
              <div className="p-4">
                {cart.length === 0 ? (
                  <div className="py-5 text-center">
                    <p className="font-semibold text-[#334a3a] dark:text-[#d4dfd5]">Tu plan empieza aquí</p>
                    <p className="mx-auto mt-1 max-w-[230px] text-xs leading-5 text-[#7a877e] dark:text-[#aab8ad]">
                      Elige una franja y agrega los servicios que quieras combinar.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#334a3a] dark:text-[#d4dfd5]">{cart.length} {cart.length === 1 ? "servicio" : "servicios"}</span>
                      <button type="button" onClick={clearCart} className="font-semibold text-[#728077] hover:text-red-700 dark:text-[#aab8ad]">
                        Vaciar
                      </button>
                    </div>
                    <p className="mb-2 rounded-lg bg-[#f4f6f2] px-3 py-2 text-xs font-medium text-[#59695d] dark:bg-[#222e26] dark:text-[#bdc9bf]">
                      {date} · {cart[0].startTime} – {cart[0].endTime}
                    </p>
                    <ul className="divide-y divide-[#edf0eb] dark:divide-[#2b3730]">
                      {cart.map((item) => (
                        <li key={item.serviceId} className="flex items-start justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-xs font-bold text-[#203329] dark:text-[#e1e9e2]">{item.serviceName}</p>
                            <p className="mt-0.5 text-[10px] text-[#758278] dark:text-[#aab8ad]">{item.serviceCategory}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-xs font-bold text-[#244533] dark:text-[#dce8dd]">{formatMoney(item.price)}</span>
                            <button
                              type="button"
                              onClick={() => removeService(item.serviceId)}
                              aria-label={`Quitar ${item.serviceName}`}
                              className="rounded-md p-1.5 text-[#9a6962] transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-[#3a2927]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 border-t border-dashed border-[#dce3da] pt-3 dark:border-[#39483e]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#68776d] dark:text-[#aab8ad]">Total estimado</span>
                        <span className="text-lg font-bold text-[#183e30] dark:text-[#c9ef75]">{formatMoney(total)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={reviewSelection}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9ef75] px-4 py-3 text-xs font-bold text-[#19352a] transition hover:bg-[#d6f694]"
                      >
                        Revisar selección <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] leading-4 text-[#849087] dark:text-[#96a49a]">
              Armar el carrito no bloquea cupos ni crea reservas.
            </p>
            {message && (
              <p role="status" className="mt-3 rounded-xl border border-[#dce9cb] bg-[#f0f7e5] px-4 py-3 text-xs leading-5 text-[#38583a] dark:border-[#3a4c38] dark:bg-[#202d22] dark:text-[#d3e4c5]">
                {message}
              </p>
            )}
          </aside>
        </div>
      </main>

      {reviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1710]/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReviewOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setReviewOpen(false);
          }}
        >
          <section
            aria-labelledby="booking-review-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-[#e5e9e2] bg-white p-5 text-[#14251d] shadow-2xl dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#edf3ee] sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#63816d] dark:text-[#9eb3a1]">
                  Revisión del carrito
                </p>
                <h2 id="booking-review-title" className="mt-1 text-xl font-bold">
                  Confirma tu selección
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setReviewOpen(false)}
                aria-label="Cerrar revisión"
                className="rounded-lg p-2 text-[#68776d] transition hover:bg-[#f1f4ee] dark:text-[#bdc9bf] dark:hover:bg-[#26342b]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 rounded-lg bg-[#f4f6f2] px-3 py-2 text-sm font-medium text-[#59695d] dark:bg-[#222e26] dark:text-[#bdc9bf]">
              {date} · {selectedSlot?.startTime} – {selectedSlot?.endTime}
            </p>

            <ul className="mt-3 divide-y divide-[#edf0eb] dark:divide-[#2b3730]">
              {cart.map((item) => (
                <li key={item.serviceId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.serviceName}</p>
                    <p className="mt-0.5 text-xs text-[#758278] dark:text-[#aab8ad]">{item.serviceCategory}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">{formatMoney(item.price)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-center justify-between border-t border-[#dce3da] pt-4 dark:border-[#39483e]">
              <span className="text-sm text-[#68776d] dark:text-[#aab8ad]">Total estimado</span>
              <span className="text-xl font-bold text-[#183e30] dark:text-[#c9ef75]">{formatMoney(total)}</span>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              La selección está lista, pero el pago conjunto aún no se puede iniciar. El endpoint de checkout disponible procesa una sola reserva; falta una operación backend que agrupe estos servicios en un único pago.
            </div>

            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#dfe5dc] px-4 py-3 text-sm font-bold text-[#7b887e] dark:bg-[#303b33] dark:text-[#87948a]"
            >
              Pago conjunto pendiente de integración <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
