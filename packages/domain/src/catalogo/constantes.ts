import type { CategoriaServicio } from "./tipos.js";

const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";
const asset = (p: string) => (ASSETS_BASE ? `${ASSETS_BASE}${p}` : p);

export const sedes = ["Poblado", "Laureles"] as const;

export const categoriasServicio: CategoriaServicio[] = [
  {
    slug: "canchas",
    name: "Canchas",
    singular: "Cancha",
    description: "Fútbol, pádel y tenis",
    icon: "court",
    tone: "lime",
    unit: "hora",
    image: asset("/catalogo/categoria-canchas.webp"),
    tagline: "Instalaciones de alto nivel",
    highlight: "Césped sintético, polvo de ladrillo y pistas de pádel panorámicas con iluminación nocturna.",
  },
  {
    slug: "piscinas",
    name: "Piscinas",
    singular: "Piscina",
    description: "Carriles y nado libre",
    icon: "pool",
    tone: "blue",
    unit: "entrada",
    image: asset("/catalogo/categoria-piscinas.webp"),
    tagline: "Espacios acuáticos climatizados",
    highlight: "Carriles semiolímpicos de entrenamiento y zona recreativa infantil.",
  },
  {
    slug: "gimnasio",
    name: "Gimnasio",
    singular: "Gimnasio",
    description: "Entrena a tu ritmo",
    icon: "gym",
    tone: "orange",
    unit: "sesión",
    image: asset("/catalogo/categoria-gimnasio.webp"),
    tagline: "Fuerza, rendimiento y bienestar",
    highlight: "Equipamiento biomecánico de última generación y zonas de entrenamiento funcional.",
  },
  {
    slug: "zona-humeda",
    name: "Zona húmeda",
    singular: "Zona húmeda",
    description: "Sauna, turco y jacuzzi",
    icon: "wellness",
    tone: "purple",
    unit: "acceso",
    image: asset("/catalogo/categoria-zona-humeda.webp"),
    tagline: "Recuperación y relajación integral",
    highlight: "Circuito de sauna seco, baño turco aromatizado y jacuzzis de hidromasaje.",
  },
];

export const serviceCategories = categoriasServicio;
