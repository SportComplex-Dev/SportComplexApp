'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  categoryBySlug,
  type CatalogItem,
  type CategorySlug,
} from '@sportcomplex/core';
import {
  buildLockCartPayload,
  buildSingleLockPayload,
  generateDynamicTimeSlots,
  getBogotaDateAfter,
  getNumericServiceId,
  validateCanAddToCart,
  type CartItem,
  type DynamicTimeSlot,
} from './cart-utils';
import { ServiceSelector } from './components/service-selector';
import { Cart } from './components/cart';
import { BookingSummaryModal } from './components/booking-summary-modal';

export default function BookPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => getBogotaDateAfter(1));
  const [timeSlots, setTimeSlots] = useState<DynamicTimeSlot[]>(() =>
    generateDynamicTimeSlots(getBogotaDateAfter(1)),
  );
  const [selectedSlot, setSelectedSlot] = useState<DynamicTimeSlot | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'todos'>('todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const cartServiceIds = useMemo(() => cart.map((item) => item.serviceId), [cart]);

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

  function handleSelectSlot(slot: DynamicTimeSlot) {
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
      const isMulti = cart.length >= 2;
      const endpoint = isMulti ? '/api/bookings/lock-cart' : '/api/bookings/lock';

      const payload = isMulti
        ? buildLockCartPayload(cart, date)
        : buildSingleLockPayload(cart[0], date);

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

      // Respuesta exitosa (201 Created): Redirigir a checkout con los IDs de las reservas o URL de Stripe
      const reservas = data?.data?.reservas || (data?.data?.reserva ? [data.data.reserva] : []);
      const bookingIds = reservas.map((r: { id: string }) => r.id).filter(Boolean);
      const checkoutUrl = data?.data?.checkout?.url;

      if (
        checkoutUrl &&
        (checkoutUrl.startsWith('http://') || checkoutUrl.startsWith('https://')) &&
        !checkoutUrl.includes('/checkout')
      ) {
        window.location.href = checkoutUrl;
      } else {
        const query =
          bookingIds.length > 0
            ? `?bookingIds=${bookingIds.join(',')}&bookingId=${bookingIds[0]}`
            : '';
        router.push(checkoutUrl || `/checkout${query}`);
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
              Selecciona una fecha y franja; después combina dos o más servicios distintos que quieras en el mismo horario y págalos juntos.
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
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            cartServiceIds={cartServiceIds}
            onAddService={handleAddService}
            disabledDateChange={cart.length > 0}
          />

          <Cart
            cart={cart}
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
        cart={cart}
        onProceedToPayment={handleProceedToPayment}
        isProcessing={isProcessingPayment}
        checkoutError={checkoutError}
      />
    </div>
  );
}
