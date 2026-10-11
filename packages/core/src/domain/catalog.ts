export type CategorySlug = 'canchas' | 'piscinas' | 'gimnasio' | 'zona-humeda';
export type CategoryIcon = 'court' | 'pool' | 'gym' | 'wellness';

export type ServiceCategory = {
  slug: CategorySlug;
  name: string;
  singular: string;
  description: string;
  icon: CategoryIcon;
  tone: string;
  /** Texto de la unidad de cobro: "/ hora", "/ sesión"… */
  unit: string;
  image: string;
  tagline?: string;
  highlight?: string;
};

export const serviceCategories: ServiceCategory[] = [
  {
    slug: 'canchas',
    name: 'Canchas',
    singular: 'Cancha',
    description: 'Fútbol, pádel y tenis',
    icon: 'court',
    tone: 'lime',
    unit: 'hora',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80',
    tagline: 'Instalaciones de alto nivel',
    highlight: 'Césped sintético, polvo de ladrillo y pistas de pádel panorámicas con iluminación nocturna.',
  },
  {
    slug: 'piscinas',
    name: 'Piscinas',
    singular: 'Piscina',
    description: 'Carriles y nado libre',
    icon: 'pool',
    tone: 'blue',
    unit: 'entrada',
    image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1600&q=80',
    tagline: 'Espacios acuáticos climatizados',
    highlight: 'Carriles semiolímpicos de entrenamiento y zona recreativa infantil.',
  },
  {
    slug: 'gimnasio',
    name: 'Gimnasio',
    singular: 'Gimnasio',
    description: 'Entrena a tu ritmo',
    icon: 'gym',
    tone: 'orange',
    unit: 'sesión',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
    tagline: 'Fuerza, rendimiento y bienestar',
    highlight: 'Equipamiento biomecánico de última generación y zonas de entrenamiento funcional.',
  },
  {
    slug: 'zona-humeda',
    name: 'Zona húmeda',
    singular: 'Zona húmeda',
    description: 'Sauna, turco y jacuzzi',
    icon: 'wellness',
    tone: 'purple',
    unit: 'acceso',
    image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1600&q=80',
    tagline: 'Recuperación y relajación integral',
    highlight: 'Circuito de sauna seco, baño turco aromatizado y jacuzzis de hidromasaje.',
  },
];

export function categoryBySlug(slug: string): ServiceCategory | undefined {
  return serviceCategories.find((category) => category.slug === slug);
}

export type CatalogStatus = 'Disponible' | 'Mantenimiento' | 'Ocupado';

export interface CatalogItem {
  id: string;
  name: string;
  category: CategorySlug;
  subCategory?: string;
  sede: string;
  description: string;
  price: number;
  capacity: number;
  status: CatalogStatus;
  image?: string;
  poolType?: 'PUBLICA' | 'PRIVADA';
}

export const initialCatalog: CatalogItem[] = [
  {
    id: 'tenis-cancha-1',
    category: 'canchas',
    subCategory: 'tenis',
    name: 'Cancha de tenis · Cancha 1',
    description: 'Polvo de ladrillo con iluminación nocturna.',
    price: 48000,
    sede: 'Poblado',
    capacity: 4,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'tenis-cancha-2',
    category: 'canchas',
    subCategory: 'tenis',
    name: 'Cancha de tenis · Cancha 2',
    description: 'Cancha profesional en polvo de ladrillo.',
    price: 48000,
    sede: 'Poblado',
    capacity: 4,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'padel-cancha-1',
    category: 'canchas',
    subCategory: 'padel',
    name: 'Pádel · Cancha 1',
    description: 'Cancha panorámica con cerramiento en vidrio.',
    price: 60000,
    sede: 'Laureles',
    capacity: 4,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'futbol-5-cancha-1',
    category: 'canchas',
    subCategory: 'futbol',
    name: 'Fútbol 5 · Cancha 1',
    description: 'Césped sintético con graderías.',
    price: 95000,
    sede: 'Poblado',
    capacity: 10,
    status: 'Mantenimiento',
    image: 'https://images.unsplash.com/photo-1529900245534-5e69e007d4b4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'futbol-5-cancha-2',
    category: 'canchas',
    subCategory: 'futbol',
    name: 'Fútbol 5 · Cancha 2',
    description: 'Césped sintético techado.',
    price: 95000,
    sede: 'Laureles',
    capacity: 10,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'piscina-nado-libre',
    category: 'piscinas',
    subCategory: 'adultos',
    name: 'Piscina · Nado libre',
    description: 'Carriles de nado libre en piscina semiolímpica.',
    price: 22000,
    sede: 'Laureles',
    capacity: 6,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&w=800&q=80',
    poolType: 'PUBLICA',
  },
  {
    id: 'piscina-carril-entrenamiento',
    category: 'piscinas',
    subCategory: 'entrenamiento',
    name: 'Piscina · Carril de entrenamiento',
    description: 'Carril exclusivo para entrenamiento.',
    price: 30000,
    sede: 'Poblado',
    capacity: 2,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
    poolType: 'PRIVADA',
  },
  {
    id: 'piscina-infantil',
    category: 'piscinas',
    subCategory: 'ninos',
    name: 'Piscina · Zona infantil y formativa',
    description: 'Piscina pedagógica climatizada de baja profundidad para niños.',
    price: 18000,
    sede: 'Laureles',
    capacity: 8,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1560089000-7433a4ebbd64?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'gimnasio-sesion-individual',
    category: 'gimnasio',
    subCategory: 'pesas',
    name: 'Gimnasio · Sesión individual',
    description: 'Acceso a zona de pesas y cardio.',
    price: 18000,
    sede: 'Laureles',
    capacity: 1,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'gimnasio-funcional',
    category: 'gimnasio',
    subCategory: 'funcional',
    name: 'Gimnasio · Zona funcional',
    description: 'Espacio de entrenamiento funcional.',
    price: 20000,
    sede: 'Poblado',
    capacity: 1,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'zona-humeda-sauna',
    category: 'zona-humeda',
    subCategory: 'sauna',
    name: 'Zona húmeda · Sauna',
    description: 'Sauna seco para relajación.',
    price: 25000,
    sede: 'Poblado',
    capacity: 6,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'zona-humeda-turco-jacuzzi',
    category: 'zona-humeda',
    subCategory: 'turco',
    name: 'Zona húmeda · Turco y jacuzzi',
    description: 'Turco y jacuzzi de agua caliente.',
    price: 28000,
    sede: 'Poblado',
    capacity: 6,
    status: 'Disponible',
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=800&q=80',
  },
];

export function minPrice(items: CatalogItem[], slug: CategorySlug): number | null {
  const prices = items.filter((item) => item.category === slug && item.status === 'Disponible').map((item) => item.price);
  return prices.length ? Math.min(...prices) : null;
}

export const defaultSchedules: Record<string, {
  serviceId: string;
  serviceName: string;
  categorySlug: string;
  capacity: number;
  isShared: boolean;
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  disabledSlots: string[];
}> = {
  'tenis-cancha-1': {
    serviceId: 'tenis-cancha-1',
    serviceName: 'Cancha de tenis · Cancha 1',
    categorySlug: 'canchas',
    capacity: 4,
    isShared: false,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'tenis-cancha-2': {
    serviceId: 'tenis-cancha-2',
    serviceName: 'Cancha de tenis · Cancha 2',
    categorySlug: 'canchas',
    capacity: 4,
    isShared: false,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'padel-cancha-1': {
    serviceId: 'padel-cancha-1',
    serviceName: 'Pádel · Cancha 1',
    categorySlug: 'canchas',
    capacity: 4,
    isShared: false,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'futbol-5-cancha-1': {
    serviceId: 'futbol-5-cancha-1',
    serviceName: 'Fútbol 5 · Cancha 1',
    categorySlug: 'canchas',
    capacity: 10,
    isShared: false,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'futbol-5-cancha-2': {
    serviceId: 'futbol-5-cancha-2',
    serviceName: 'Fútbol 5 · Cancha 2',
    categorySlug: 'canchas',
    capacity: 10,
    isShared: false,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'piscina-nado-libre': {
    serviceId: 'piscina-nado-libre',
    serviceName: 'Piscina · Nado libre',
    categorySlug: 'piscinas',
    capacity: 12,
    isShared: true,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: ['13:00'],
  },
  'piscina-carril-entrenamiento': {
    serviceId: 'piscina-carril-entrenamiento',
    serviceName: 'Piscina · Carril de entrenamiento',
    categorySlug: 'piscinas',
    capacity: 2,
    isShared: false,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'gimnasio-sesion-individual': {
    serviceId: 'gimnasio-sesion-individual',
    serviceName: 'Gimnasio · Sesión individual',
    categorySlug: 'gimnasio',
    capacity: 25, // HU-05: Capacidad máxima de 25 personas para gimnasio
    isShared: true,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'gimnasio-funcional': {
    serviceId: 'gimnasio-funcional',
    serviceName: 'Gimnasio · Zona funcional',
    categorySlug: 'gimnasio',
    capacity: 20,
    isShared: true,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'zona-humeda-sauna': {
    serviceId: 'zona-humeda-sauna',
    serviceName: 'Zona húmeda · Sauna',
    categorySlug: 'zona-humeda',
    capacity: 8,
    isShared: true,
    startHour: 7,
    endHour: 21,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
  'zona-humeda-turco-jacuzzi': {
    serviceId: 'zona-humeda-turco-jacuzzi',
    serviceName: 'Zona húmeda · Turco y jacuzzi',
    categorySlug: 'zona-humeda',
    capacity: 10,
    isShared: true,
    startHour: 7,
    endHour: 21,
    slotDurationMinutes: 60,
    disabledSlots: [],
  },
};

export const sedes = ['Poblado', 'Laureles'] as const;

export function makeId(name: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base || 'item'}-${Math.random().toString(36).slice(2, 7)}`;
}
