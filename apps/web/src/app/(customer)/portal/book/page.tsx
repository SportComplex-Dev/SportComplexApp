'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  categoryBySlug,
  type CatalogItem,
  type CategorySlug,
} from '@sportcomplex/core';
import {
  buildLockCartPayload,
  buildContinuousLockCartPayload,
  buildSingleLockPayload,
  calculateMultiSlotPricing,
  generateDynamicTimeSlots,
  getBogotaDateAfter,
  getNumericServiceId,
  resolveCheckoutRedirection,
  validateCanAddToCart,
  ServiceSelector,
  Cart,
  BookingSummaryModal,
  usePublicCatalog,
  type CartItem,
  type DynamicTimeSlot,
} from '@sportcomplex/features-booking';

export default function BookPage() {
  const router = useRouter();
  const { catalog } = usePublicCatalog();
  const [date, setDate] = useState(() => getBogotaDateAfter(1));
  const [timeSlots, setTimeSlots] = useState<DynamicTimeSlot[]>(() =>
    generateDynamicTimeSlots(getBogotaDateAfter(1)),
  );
  const [selectedSlot, setSelectedSlot] = useState<DynamicTimeSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<DynamicTimeSlot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'todos'>('todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Consultar membresía activa del usuario autenticado para aplicar el 30% de descuento (RN-08 / TSK-FE-31)
  useEffect(() => {
    let active = true;
    fetch('/api/memberships')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { success?: boolean; data?: { membresiaActiva?: { estado?: string } | null } }) => {
        if (!active || !data?.success || !data?.data) return;
        const activeMembership = data.data.membresiaActiva;
        if (activeMembership && activeMembership.estado === 'VIGENTE') {
          setIsMember(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const cartServiceIds = useMemo(() => cart.map((item) => item.serviceId), [cart]);

  // Servicio activo para alimentar el precio base y nombre en el selector continuo de franjas
  const activeService = useMemo(() => {
    if (cart.length > 0) {
      const first = cart[0];
      const found = catalog.find((s) => s.id === first?.serviceId);
      return {
        name: first?.serviceName ?? found?.name,
        price: first?.price ?? found?.price ?? 48000,
      };
    }
    if (selectedCategory !== 'todos') {
      const catService = catalog.find(
        (s) => s.category === selectedCategory && s.status === 'Disponible',
      );
      if (catService) return { name: catService.name, price: catService.price };
    }
    const defaultService = catalog.find((s) => s.status === 'Disponible');
    return defaultService
      ? { name: defaultService.name, price: defaultService.price }
      : { name: undefined, price: 48000 };
  }, [cart, selectedCategory, catalog]);

  const basePricePerHour = activeService.price;

  const displayCart = useMemo(() => {
    if (cart.length !== 1 || selectedSlots.length < 2) return cart;
    const item = cart[0]!;
    const lastSlot = [...selectedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime)).at(-1);
    if (!lastSlot) return cart;
    return [{
      ...item,
      endTime: lastSlot.endTime,
      price: calculateMultiSlotPricing(basePricePerHour, selectedSlots.length, isMember).total,
    }];
  }, [cart, selectedSlots, basePricePerHour, isMember]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    const newSlots = generateDynamicTimeSlots(newDate);
    setTimeSlots(newSlots);
    // Si la franja previamente seleccionada ya no existe o no está disponible en la nueva fecha, deseleccionarla
    if (selectedSlot) {
      const stillAvailable = newSlots.find(
        (s) => s.startTime === selectedSlot.startTime && s.isAvailable,
      );
      if (!stillAvailable) {
        setSelectedSlot(null);
      }
    }
    setMessage('');
  }

  function handleSlotsChange(slots: DynamicTimeSlot[]) {
    if (cart.length > 0 && selectedSlots.length > 0) {
      const sameSelection = slots.length === selectedSlots.length &&
        slots.every((slot, index) => slot.startTime === selectedSlots[index]?.startTime);
      if (!sameSelection) {
        setMessage('Vacía el carrito antes de cambiar las franjas seleccionadas.');
        return;
      }
    }
    setSelectedSlots(slots);
    setSelectedSlot(slots.length > 0 && slots[0] ? slots[0] : null);
    setMessage('');
  }

  function handleSelectSlot(slot: DynamicTimeSlot | null) {
    if (!slot) {
      setSelectedSlot(null);
      setSelectedSlots([]);
      setMessage('');
      return;
    }
    if (cart.length > 0 && selectedSlot?.startTime !== slot.startTime) {
      setMessage(
        'Vacía el carrito antes de cambiar de horario para mantener los servicios en la misma franja.',
      );
      return;
    }
    setSelectedSlot(slot);
    setMessage('');
  }

  function handleAddService(service: CatalogItem) {
    if (!selectedSlot) {
      setMessage('Primero selecciona una franja horaria para agregar servicios.');
      return;
    }

    const numericId = getNumericServiceId(service.id);

    if (selectedSlots.length > 1 && cart.length > 0) {
      setMessage('Una reserva de varias horas continuas solo puede incluir un servicio.');
      return;
    }

    const validation = validateCanAddToCart(cart, {
      serviceId: service.id,
      numericServiceId: numericId,
      date,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    });

    if (!validation.valid) {
      setMessage(validation.message);
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        serviceId: service.id,
        numericServiceId: numericId,
        serviceName: service.name,
        serviceCategory: categoryBySlug(service.category)?.name ?? 'Servicio',
        date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        price: service.price,
      },
    ]);
    setMessage('');
  }

  function handleRemoveService(serviceId: string) {
    setCart((prev) => prev.filter((item) => item.serviceId !== serviceId));
    setMessage('');
  }

  function handleClearCart() {
    setCart([]);
    setSelectedSlot(null);
    setSelectedSlots([]);
    setMessage('');
    setCheckoutError('');
  }

  function handleReviewSelection() {
    if (cart.length === 0) {
      setMessage('Agrega al menos un servicio antes de revisar la selección.');
      return;
    }
    setCheckoutError('');
    setReviewOpen(true);
  }

  async function handleProceedToPayment() {
    if (cart.length === 0 || !selectedSlot) return;

    setIsProcessingPayment(true);
    setCheckoutError('');

    try {
      const isContinuous = cart.length === 1 && selectedSlots.length >= 2;
      const isMultiService = cart.length >= 2;
      const endpoint = isContinuous || isMultiService
        ? '/api/bookings/lock-cart'
        : '/api/bookings/lock';

      const payload = isContinuous
        ? buildContinuousLockCartPayload(cart[0]!.numericServiceId, selectedSlots, date)
        : isMultiService
          ? buildLockCartPayload(cart, date)
          : buildSingleLockPayload(cart[0]!, date);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login?redirect=/portal/book');
          return;
        }

        const errorCode = data?.error?.code;
        const errorMessage =
          (typeof data?.error === 'object' && data?.error !== null ? data.error.message : null) ||
          (typeof data?.error === 'string' ? data.error : null) ||
          data?.message;

        if (response.status === 404 || errorCode === 'SLOT_NOT_FOUND') {
          setCheckoutError(
            errorMessage ||
              'La franja solicitada no existe o no tiene cupo en uno de los servicios seleccionados.',
          );
          return;
        }

        if (
          response.status === 409 ||
          errorCode === 'CONFLICT' ||
          errorCode === 'OVERLAPPING_BOOKING'
        ) {
          // Refrescar disponibilidad dinámica y alertar al usuario (RN-07)
          setTimeSlots(generateDynamicTimeSlots(date));
          setCheckoutError(
            errorMessage ||
              'Conflicto de disponibilidad: una de las franjas ya fue reservada o el bloqueo expiró. Por favor actualiza tu selección.',
          );
          return;
        }

        setCheckoutError(
          errorMessage || 'No se pudo iniciar el proceso de pago. Intenta de nuevo.',
        );
        return;
      }

      // Respuesta exitosa (201 Created): Redirigir a pasarela externa (Stripe) o vista interna de checkout
      const reservas = data?.data?.reservas || (data?.data?.reserva ? [data.data.reserva] : []);
      const bookingIds = reservas.map((r: { id: string }) => r.id).filter(Boolean);
      const checkoutUrl = data?.data?.checkout?.url;

      const redirection = resolveCheckoutRedirection(checkoutUrl, bookingIds);
      if (redirection.type === 'external') {
        window.location.href = redirection.url;
      } else {
        router.push(redirection.url);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : 'Error inesperado al conectar con el servidor.',
      );
    } finally {
      setIsProcessingPayment(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#14251d] transition-colors dark:bg-[#111815] dark:text-[#edf3ee]">
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* Banner Superior */}
        <header className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-[#123e30] px-6 py-6 text-white shadow-lg sm:px-8">
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5"
          />
          <div className="relative max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c9ef75]">
              Reserva tu próximo plan
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Elige tu espacio. <span className="text-[#c9ef75]">Arma tu plan.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-white/75">
              Selecciona una franja o varias horas consecutivas para un servicio. También puedes combinar servicios distintos en una misma franja.
            </p>
          </div>
        </header>

        {/* Layout Principal: Selector de Servicios y Carrito */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ServiceSelector
            date={date}
            onDateChange={handleDateChange}
            timeSlots={timeSlots}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSelectSlot}
            selectedSlots={selectedSlots}
            onSlotsChange={handleSlotsChange}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            cartServiceIds={cartServiceIds}
            onAddService={handleAddService}
            disabledDateChange={cart.length > 0}
            basePricePerHour={basePricePerHour}
            isMember={isMember}
            serviceName={activeService.name}
            onValidationError={setMessage}
          />

          <Cart
            cart={displayCart}
            onRemoveService={handleRemoveService}
            onClearCart={handleClearCart}
            onReviewSelection={handleReviewSelection}
            feedbackMessage={message}
          />
        </div>
      </main>

      {/* Modal de Revisión y Confirmación Multi-servicio */}
      <BookingSummaryModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        cart={displayCart}
        onProceedToPayment={handleProceedToPayment}
        isProcessing={isProcessingPayment}
        checkoutError={checkoutError}
      />
    </div>
  );
}
