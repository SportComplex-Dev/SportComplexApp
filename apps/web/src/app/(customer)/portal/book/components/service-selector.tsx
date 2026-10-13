'use client';

import { useMemo } from 'react';
import { Check, Clock3, Plus } from 'lucide-react';
import {
  categoryBySlug,
  initialCatalog,
  serviceCategories,
  type CategorySlug,
  type CatalogItem,
} from '@sportcomplex/core';
import { Badge } from '@sportcomplex/ui';
import {
  formatMoney,
  getBogotaDateAfter,
  type DynamicTimeSlot,
} from '../cart-utils';

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
  timeSlots,
  selectedSlot,
  onSelectSlot,
  selectedCategory,
  onCategoryChange,
  cartServiceIds,
  onAddService,
  disabledDateChange = false,
}: ServiceSelectorProps) {
  const availableCatalog = useMemo(
    () => initialCatalog.filter((s) => s.status === 'Disponible'),
    [],
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
          {timeSlots.map((slot) => {
            const isActive = selectedSlot?.startTime === slot.startTime;
            const isBlocked = !slot.isAvailable || (disabledDateChange && !isActive);

            return (
              <button
                key={slot.startTime}
                type="button"
                aria-pressed={isActive}
                disabled={isBlocked}
                onClick={() => onSelectSlot(slot)}
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
              </button>
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

      {/* Tabs de Filtro */}
      <div
        className="sticky top-[72px] z-10 -mx-1 mb-3 flex gap-2 overflow-x-auto bg-[#f7f8f5]/95 px-1 py-2 backdrop-blur dark:bg-[#111815]/95"
        aria-label="Filtrar por categoría"
      >
        <button
          type="button"
          aria-pressed={selectedCategory === 'todos'}
          onClick={() => onCategoryChange('todos')}
          className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
            selectedCategory === 'todos'
              ? 'bg-[#183e30] text-white dark:bg-[#c9ef75] dark:text-[#19352a]'
              : 'border border-[#e0e6df] bg-white text-[#526058] hover:bg-[#f1f4ee] dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#c2cec4] dark:hover:bg-[#26342b]'
          }`}
        >
          Todos
        </button>
        {serviceCategories.map((category) => (
          <button
            key={category.slug}
            type="button"
            aria-pressed={selectedCategory === category.slug}
            onClick={() => onCategoryChange(category.slug)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              selectedCategory === category.slug
                ? 'bg-[#183e30] text-white dark:bg-[#c9ef75] dark:text-[#19352a]'
                : 'border border-[#e0e6df] bg-white text-[#526058] hover:bg-[#f1f4ee] dark:border-[#39483e] dark:bg-[#19231d] dark:text-[#c2cec4] dark:hover:bg-[#26342b]'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Grid de Servicios */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visibleServices.map((service, index) => {
          const inCart = cartServiceIds.includes(service.id);
          const color = ['#eaf2d9', '#e4f1f3', '#faeee1', '#eeeafa'][index % 4];
          const isAddDisabled = !selectedSlot || inCart;

          return (
            <article
              key={service.id}
              title={service.description}
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
                  {categoryBySlug(service.category)?.name ?? 'Servicio'}
                </Badge>
                <h3 className="truncate text-sm font-bold text-[#18291f] dark:text-[#edf3ee]">
                  {service.name}
                </h3>
                <span className="text-xs font-bold text-[#183c2e] dark:text-[#dce8dd]">
                  {formatMoney(service.price)}
                </span>
              </div>
              <button
                type="button"
                disabled={isAddDisabled}
                onClick={() => onAddService(service)}
                aria-label={inCart ? `${service.name} ya está en el carrito` : `Agregar ${service.name} al carrito`}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#edf5e2] px-2.5 py-2 text-xs font-bold text-[#31563a] transition hover:bg-[#e1efce] disabled:cursor-not-allowed disabled:bg-[#f1f3ef] disabled:text-[#9aa49c] dark:bg-[#2b3b2a] dark:text-[#d8efb3] dark:hover:bg-[#354a32] dark:disabled:bg-[#252d27] dark:disabled:text-[#758078]"
              >
                {inCart ? <Check size={14} /> : <Plus size={14} />}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

