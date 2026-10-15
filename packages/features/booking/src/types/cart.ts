export interface CartItem {
  serviceId: string;
  numericServiceId: number;
  serviceName: string;
  serviceCategory: string;
  date: string;
  startTime: string; // Formato "HH:MM"
  endTime: string;   // Formato "HH:MM"
  price: number;
}

export interface DynamicTimeSlot {
  startTime: string;
  endTime: string;
  label: string;
  isAvailable: boolean;
  disabledReason?: string | undefined;
}

export type AddToCartValidationResult =
  | { valid: true }
  | { valid: false; code: 'DUPLICATE_ITEM'; message: string }
  | { valid: false; code: 'DIFFERENT_SLOT'; message: string };

export interface CheckoutRedirection {
  type: 'external' | 'internal';
  url: string;
}
