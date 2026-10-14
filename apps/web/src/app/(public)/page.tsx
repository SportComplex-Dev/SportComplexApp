'use client';

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { formatMoney, minPrice, type CategorySlug } from "@sportcomplex/core";
import { categoryIcons } from "@/components/category-icons";
import { IconBox } from "@/components/icon-box";
import { SplashScreen } from "@/components/splash-screen";
import { FacilityShowcase } from "@/components/home/facility-showcase";
import { ClubEvents } from "@/components/home/club-events";
import { LifestyleAndDigitalPass } from "@/components/home/lifestyle-and-digital-pass";
import { FaqSection } from "@/components/home/faq-section";
import { InstitutionalFooter } from "@/components/home/institutional-footer";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { usePublicCatalog } from "@/hooks/use-public-catalog";

const categoryMeta: Record<string, {
  name: string;
  description: string;
  icon: 'court' | 'pool' | 'gym' | 'wellness';
  tone: string;
  image: string;
}> = {
  canchas: {
    name: "Canchas",
    description: "Fútbol, pádel y tenis",
    icon: "court",
    tone: "lime",
    image: "/images/catalogo/categoria-canchas.webp",
  },
  piscinas: {
    name: "Piscinas",
    description: "Carriles y nado libre",
    icon: "pool",
    tone: "blue",
    image: "/images/catalogo/categoria-piscinas.webp",
  },
  gimnasio: {
    name: "Gimnasio",
    description: "Entrena a tu ritmo",
    icon: "gym",
    tone: "orange",
    image: "/images/catalogo/categoria-gimnasio.webp",
  },
  "zona-humeda": {
    name: "Zona húmeda",
    description: "Sauna, turco y jacuzzi",
    icon: "wellness",
    tone: "purple",
    image: "/images/catalogo/categoria-zona-humeda.webp",
  },
};

export default function HomePage() {
  const { catalog, categories } = usePublicCatalog();
  return (
    <>
      <SplashScreen />

      {/* Hero Cinematográfico con Carrusel Multideporte */}
      <section className="hero-wrap">
        <HeroCarousel />
        <div className="hero-content">
          <div className="eyebrow hero-eyebrow">
            <span className="live-dot" /> UN LUGAR PARA LLEGAR MÁS LEJOS
          </div>
          <h1 className="hero-blur-title">
            <span className="word-blur-item" style={{ animationDelay: "120ms" }}>Tu</span>{" "}
            <span className="word-blur-item" style={{ animationDelay: "220ms" }}>mejor</span>{" "}
            <span className="word-blur-item" style={{ animationDelay: "320ms" }}>versión</span>
            <br />
            <span className="word-blur-item" style={{ animationDelay: "420ms" }}>empieza</span>{" "}
            <span className="word-blur-item word-highlight" style={{ animationDelay: "520ms" }}>
              <span>aquí.</span>
            </span>
          </h1>
          <p>Entrena, juega y recarga energía. Todo lo que te mueve, en un solo lugar.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/services" className="action-button">
              Reserva tu espacio <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="hero-location">
          <MapPin size={14} /> Medellín, Colombia <span className="hero-location-dot" /> Abierto hoy hasta las 11:00 p. m.
        </div>
        <div className="hero-scroll">
          DESLIZA PARA EXPLORAR <span />
        </div>
      </section>

      {/* Sección 4: Showcase Interactivo de Instalaciones */}
      <FacilityShowcase />

      {/* Sección Catálogo Rápido & Pasos */}
      <section className="section-shell service-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">TODO EN UN SOLO LUGAR</div>
            <h2>
              Encuentra tu <span>espacio.</span>
            </h2>
          </div>
          <Link href="/services" className="text-link">
            Ver todos los servicios <ArrowRight size={16} />
          </Link>
        </div>

        <div className="category-grid">
          {categories.map(({ slug, nombre }, index) => {
            const meta = categoryMeta[slug] || {
              name: nombre,
              description: `Servicios de ${nombre.toLowerCase()}`,
              icon: "court" as const,
              tone: "lime",
              image: "/images/catalogo/categoria-canchas.webp",
            };
            const from = minPrice(catalog, slug as CategorySlug);
            return (
              <Link className="category-card" key={slug} href={`/services/${slug}`}>
                <div className="category-media">
                  {meta.image && (
                    <Image
                      src={meta.image}
                      alt={nombre}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="category-img"
                    />
                  )}
                  <div className="category-media-overlay" />
                  <div className="category-badge-floating">
                    <IconBox icon={categoryIcons[meta.icon]} tone={meta.tone} />
                  </div>
                  <span className="category-index-badge">0{index + 1}</span>
                </div>
                <div className="category-body">
                  <h3>{nombre}</h3>
                  <p>{meta.description}</p>
                  <div className="category-bottom">
                    <span>{from ? `Desde ${formatMoney(from)}` : "Próximamente"}</span>
                    <span className="round-arrow">
                      <ArrowRight size={15} className="-rotate-45" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="how-section">
          <div className="how-intro">
            <div className="eyebrow">ASÍ DE FÁCIL</div>
            <h2>
              Listo en <span>tres pasos.</span>
            </h2>
            <p>Más tiempo haciendo lo que te gusta. Menos tiempo organizándolo.</p>
          </div>
          <div className="steps-grid">
            {[
              { n: "01", title: "Elige", text: "Encuentra el espacio ideal para ti." },
              { n: "02", title: "Reserva", text: "Escoge el día y la hora que prefieras." },
              { n: "03", title: "Paga", text: "Paga fácil y llega listo para jugar." },
            ].map((step, i) => (
              <div className="step-card" key={step.n}>
                <span className="step-number">{step.n}</span>
                <div className="step-connector">{i < 2 && <span />}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección 6: Agenda de Torneos & Vida en el Club */}
      <ClubEvents />

      {/* Sección 7 & 8: Tercer Tiempo (Lounge & Coworking) y Pase Digital QR */}
      <LifestyleAndDigitalPass />

      {/* Sección 10: Preguntas Frecuentes y Políticas */}
      <FaqSection />

      {/* Footer Institucional Completo */}
      <InstitutionalFooter />
    </>
  );
}
