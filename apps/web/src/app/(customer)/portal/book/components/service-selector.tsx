'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, Clock3, Plus } from 'lucide-react';
import {
  type CategorySlug,
  type CatalogItem,
} from '@sportcomplex/core';
import { Badge } from '@sportcomplex/ui';
import {
  formatMoney,
  getBogotaDateAfter,
  type DynamicTimeSlot,
} from '@/app/(customer)/portal/book/cart-utils';
import { usePublicCatalog } from '@/hooks/use-public-catalog';

export interface ServiceSelectorProps {
  date: string;
  onDateChange: (date: string) => void;
  timeSlots: DynamicTimeSlot[];
  selectedSlot: DynamicTimeSlot | null;
  onSelectSlot: (slot: DynamicTimeSlot) => void;
  selectedCategory: CategorySlug | 'todos';
  onCategoryChange: (category: CategorySlug | 'todos') => void;
  cartServiceIds: string[];
  onAddService: (service: CatalogItem) => void;
  disabledDateChange?: boolean;
}

export function ServiceSelector({
  date,
  onDateChange,
  timeSlots: initialTimeSlots,
  selectedSlot,
  onSelectSlot,
  selectedCategory,
  onCategoryChange,
  cartServiceIds,
  onAddService,
  disabledDateChange = false,
}: ServiceSelectorProps) {
  const shouldReduceMotion = useReducedMotion();
  const { catalog, categories } = usePublicCatalog();

  // Consumir /api/bookings/availability?fecha=
  const [availabilitySlots, setAvailabilitySlots] = useState<DynamicTimeSlot[] | null>(null);

  useEffect(() => {
    let active = true;
    if (!date) return;

    fetch(`/api/bookings/availability?fecha=${encodeURIComponent(date)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al consultar disponibilidad');
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        // json.data es un array de servicios con slots, o array directo de slots
        if (json.success && json.data) {
          // Si es array de servicios con slots, recopilar disponibilidad o verificar
          // Si alguno tiene slots disponibles o mapear las franjas
          const raw = json.data;
          if (Array.isArray(raw)) {
            // Recopilamos todas las franjas devueltas
            const slotMap = new Map<string, boolean>();
            for (const item of raw) {
              const slots = Array.isArray(item.slots) ? item.slots : (Array.isArray(item) ? item : []);
              for (const s of slots) {
                if (s.franja?.horaInicio && s.franja?.horaFin) {
                  const startStr = typeof s.franja.horaInicio === 'string'
                    ? s.franja.horaInicio.slice(11, 16)
                    : new Date(s.franja.horaInicio).toISOString().slice(11, 16);
                  const available = !s.bloqueadaMantenimiento && (s.cuposDisponibles > 0);
                  if (available) {
                    slotMap.set(startStr, true);
                  } else if (!slotMap.has(startStr)) {
                    slotMap.set(startStr, false);
                  }
                }
              }
            }
            if (slotMap.size > 0) {
              const updatedSlots = initialTimeSlots.map((slot) => {
                const hasAvail = slotMap.get(slot.startTime);
                if (hasAvail !== undefined) {
                  return {
                    ...slot,
                    isAvailable: slot.isAvailable && hasAvail,
                    disabledReason: !hasAvail ? 'Sin cupos disponibles' : slot.disabledReason,
                  };
                }
                return slot;
              });
              setAvailabilitySlots(updatedSlots);
              return;
            }
          }
        }
        setAvailabilitySlots(null);
      })
      .catch(() => {
        if (active) setAvailabilitySlots(null);
      });

    return () => {
      active = false;
    };
  }, [date, initialTimeSlots]);

  const activeTimeSlots = availabilitySlots || initialTimeSlots;

  const availableCatalog = useMemo(
    () => catalog.filter((s) => s.status === 'Disponible'),
    [catalog],
  );

  const visibleServices = useMemo(() => {
    if (selectedCategory === 'todos') return availableCatalog;
    return availableCatalog.filter((s) => s.category === selectedCategory);
  }, [availableCatalog, selectedCategory]);

  return (
    <section aria-label="Selección de servicios y horarios" className="min-w-0">
      {/* Paso 1: Fecha y Franja Horaria Dinámica */}
      <div className="mb-4 rounded-2xl border border-[#e5e9e2] bg-white p-4 shadow-sm dark:border-[#2b3730] dark:bg-[#19231d] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#63816d] dark:text-[#9eb3a1]">
              Paso 1 · Fecha y horario dinámico
            </p>
            <h2 className="mt-1 text-lg font-bold">¿Cuándo quieres venir?</h2>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[#43574b] dark:text-[#c7d2c9]">
            Fecha
            <input
              type="date"
              min={getBogotaDateAfter(0)}
              max={getBogotaDateAfter(15)}
              value={date}
              disabled={disabledDateChange}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded-lg border border-[#dce3da] bg-white px-3 py-2 text-sm text-[#14251d] outline-none focus:border-[#1d6048] focus:ring-2 focus:ring-[#1d6048]/15 disabled:bg-[#f3f5f1] dark:border-[#39483e] dark:bg-[#202d25] dark:text-white dark:disabled:bg-[#29342c]"
            />
          </label>
        </div>

        {/* Franjas Horarias Dinámicas */}
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Franjas horarias disponibles">
          {activeTimeSlots.map((slot) => {
            const isActive = selectedSlot?.startTime === slot.startTime;
            const isBlocked = !slot.isAvailable || (disabledDateChange && !isActive);

            return (
              <motion.button
                key={slot.startTime}
                type="button"
                aria-pressed={isActive}
                disabled={isBlocked}
                onClick={() => onSelectSlot(slot)}
                whileHover={isBlocked || shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={isBlocked || shouldReduceMotion ? undefined : { scale: 0.96 }}
                title={slot.disabledReason || `${slot.label} (${slot.isAvailable ? 'Disponible' : 'No disponible'})`}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border-[#1d6048] bg-[#edf5e2] text-[#214d36] dark:border-[#7ca657] dark:bg-[#2c3c2a] dark:text-[#d8efb3]'
                    : isBlocked
                      ? 'cursor-not-allowed border-[#edf0eb] bg-[#f7f8f6] text-[#a0aaa2] dark:border-[#303b33] dark:bg-[#202722] dark:text-[#68756b]'
                      : 'border-[#dce4da] bg-white text-[#354b3b] hover:border-[#72947a] hover:bg-[#f7faf4] dark:border-[#39483e] dark:bg-[#202d25] dark:text-[#d4dfd5] dark:hover:bg-[#28362c]'
                }`}
              >
                <Clock3 size={15} />
                <span>{slot.label}</span>
                {isActive && <Check size={15} />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Paso 2: Filtros de Categoría y Servicios */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#63816d] dark:text-[#9eb3a1]">
            Paso 2 · Servicios
          </p>
          <h2 className="mt-0.5 text-lg font-bold">Agrega a tu plan</h2>
        </div>
        <span className="text-xs text-[#728077] dark:text-[#aab8ad]">
          {visibleServices.length} opciones disponibles
        </span>
      </div>

      {/* Tabs de Filtro con layoutId deslizante */}
      <div
        className="sticky top-[72px] z-10 -mx-1 mb-3 flex gap-2 overflow-x-auto bg-[#f7f8f5]/95 px-1 py-2 backdrop-blur dark:bg-[#111815]/95"
        aria-label="Filtrar por categoría"
      >
        <motion.button
          type="button"
          whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
          aria-pressed={selectedCategory === 'todos'}
          onClick={() => onCategoryChange('todos')}
          className={`relative shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
            selectedCategory === 'todos'
              ? 'text-white dark:text-[#19352a]'
              : 'border border-[#e0e6df] bg-white text-[#526058] hover:bg-[#f1f4ee] dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#c2cec4] dark:hover:bg-[#26342b]'
          }`}
        >
          {selectedCategory === 'todos' && (
            <motion.span
              layoutId="activeCategoryFilter"
              className="absolute inset-0 rounded-full bg-[#183e30] dark:bg-[#c9ef75] -z-0"
              transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 30 }}
            />
          )}
          <span className="relative z-10">Todos</span>
        </motion.button>
        {categories.map((category) => (
          <motion.button
            key={category.slug}
            type="button"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            aria-pressed={selectedCategory === category.slug}
            onClick={() => onCategoryChange(category.slug as CategorySlug)}
            className={`relative shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              selectedCategory === category.slug
                ? 'text-white dark:text-[#19352a]'
                : 'border border-[#e0e6df] bg-white text-[#526058] hover:bg-[#f1f4ee] dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#c2cec4] dark:hover:bg-[#26342b]'
            }`}
          >
            {selectedCategory === category.slug && (
              <motion.span
                layoutId="activeCategoryFilter"
                className="absolute inset-0 rounded-full bg-[#183e30] dark:bg-[#c9ef75] -z-0"
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10">{category.nombre}</span>
          </motion.button>
        ))}
      </div>

      {/* Grid de Servicios con Transición Fluida */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
        >
          {visibleServices.map((service, index) => {
            const inCart = cartServiceIds.includes(service.id);
            const color = ['#eaf2d9', '#e4f1f3', '#faeee1', '#eeeafa'][index % 4];
            const isAddDisabled = !selectedSlot || inCart;
            const categoryName = categories.find((c) => c.slug === service.category)?.nombre ?? 'Servicio';

            return (
              <motion.article
                key={service.id}
                title={service.description}
                whileHover={shouldReduceMotion ? undefined : { y: -3, transition: { type: 'spring', stiffness: 350, damping: 25 } }}
                className={`flex items-center gap-3 rounded-xl border bg-white p-2.5 shadow-sm transition hover:shadow-md dark:bg-[#19231d] ${
                  inCart ? 'border-[#7ca657]' : 'border-[#e5e9e2] dark:border-[#2b3730]'
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-base font-bold text-[#244b37]"
                  style={{ backgroundColor: color }}
                >
                  {service.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase tracking-[0.08em]">
                    {categoryName}
                  </Badge>
                  <h3 className="truncate text-sm font-bold text-[#18291f] dark:text-[#edf3ee]">
                    {service.name}
                  </h3>
                  <span className="text-xs font-bold text-[#183c2e] dark:text-[#dce8dd]">
                    {formatMoney(service.price)}
                  </span>
                </div>
                <motion.button
                  type="button"
                  disabled={isAddDisabled}
                  whileHover={isAddDisabled || shouldReduceMotion ? undefined : { scale: 1.06 }}
                  whileTap={isAddDisabled || shouldReduceMotion ? undefined : { scale: 0.94 }}
                  onClick={() => onAddService(service)}
                  aria-label={inCart ? `${service.name} ya está en el carrito` : `Agregar ${service.name} al carrito`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#edf5e2] px-2.5 py-2 text-xs font-bold text-[#31563a] transition hover:bg-[#e1efce] disabled:cursor-not-allowed disabled:bg-[#f1f3ef] disabled:text-[#9aa49c] dark:bg-[#2b3b2a] dark:text-[#d8efb3] dark:hover:bg-[#354a32] dark:disabled:bg-[#252d27] dark:disabled:text-[#758078]"
                >
                  {inCart ? <Check size={14} /> : <Plus size={14} />}
                </motion.button>
              </motion.article>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

