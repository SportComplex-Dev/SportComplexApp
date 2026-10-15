export type CategoriaSlug = 'canchas' | 'piscinas' | 'gimnasio' | 'zona-humeda';
export type CategorySlug = CategoriaSlug;

export type CategoriaIcono = 'court' | 'pool' | 'gym' | 'wellness';
export type CategoryIcon = CategoriaIcono;

export interface CategoriaServicio {
  slug: CategoriaSlug;
  name: string;
  singular: string;
  description: string;
  icon: CategoriaIcono;
  tone: string;
  /** Texto de la unidad de cobro: "/ hora", "/ sesión"… */
  unit: string;
  image: string;
  tagline?: string;
  highlight?: string;
}
export type ServiceCategory = CategoriaServicio;

export type ModalidadServicio = 'EXCLUSIVA' | 'AFORO';
export type ServiceModality = ModalidadServicio;

export type TipoPiscina = 'PUBLICA' | 'PRIVADA';
export type PoolType = TipoPiscina;

export type EstadoServicio = 'ACTIVO' | 'INHABILITADO';
export type ServiceStatus = EstadoServicio;

export interface HorarioServicio {
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  disabledSlots: string[];
}
export type ServiceSchedule = HorarioServicio;

export interface ItemCatalogo {
  id: string;
  name: string;
  category: CategoriaSlug;
  description: string;
  price: number;
  capacity: number;
  durationMinutes: number;
  requiresMembership: boolean;
  sede: string;
  image: string;
  badge?: string;
  schedule?: HorarioServicio;
  isShared?: boolean;
}
export type CatalogItem = ItemCatalogo;

export interface ConfiguracionHorarioOperativo {
  serviceId: string;
  serviceName: string;
  categorySlug: string;
  capacity: number;
  isShared: boolean;
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  disabledSlots: string[];
}
export type OperatingScheduleConfig = ConfiguracionHorarioOperativo;

export interface RanuraOperativaGenerada {
  time: string;
  endTime: string;
  label: string;
  startHour: number;
  endHour: number;
  capacity: number;
  isShared: boolean;
  isAvailable: boolean;
  disabledReason?: string;
}
export type GeneratedOperatingSlot = RanuraOperativaGenerada;

export interface DiaCalendarioReserva {
  dateISO: string;
  dayNumber: number;
  weekdayShort: string;
  weekdayFull: string;
  monthShort: string;
  monthFull: string;
  year: number;
  isToday: boolean;
  isPast: boolean;
  isWithinWindow: boolean;
  isBeyondWindow: boolean;
  daysAhead: number;
}
export type BookingCalendarDay = DiaCalendarioReserva;
