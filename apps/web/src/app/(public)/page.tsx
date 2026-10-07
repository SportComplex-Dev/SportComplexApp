// RF-00 Landing institucional estática (SSG) conforme a ARCHITECTURE §4. LCP < 1.5s.
export const dynamic = 'force-static';

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { formatMoney, minPrice, serviceCategories, initialCatalog } from "@sportcomplex/core";
import { categoryIcons } from "@/components/category-icons";
import { IconBox } from "@/components/icon-box";
import { AthleticMarquee } from "@/components/athletic-marquee";
import { SplashScreen } from "@/components/splash-screen";
import { FacilityShowcase } from "@/components/home/facility-showcase";
import { MembershipsSection } from "@/components/home/memberships-section";
import { ClubEvents } from "@/components/home/club-events";
import { LifestyleAndDigitalPass } from "@/components/home/lifestyle-and-digital-pass";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { FaqSection } from "@/components/home/faq-section";
import { InstitutionalFooter } from "@/components/home/institutional-footer";

export default function HomePage() {
  return (
    <>
      <SplashScreen />

      {/* Hero Cinematográfico */}
      <section className="hero-wrap">
        <div className="hero-image" />
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
            <Link href="/portal/book" className="action-button">
              Reserva tu espacio <ArrowRight size={17} />
            </Link>
            <Link href="/portal/book" className="hero-secondary">
              Explorar servicios
            </Link>
            <Link href="/register" className="hero-secondary">
              Hazte socio
            </Link>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack">
              <span>J</span>
              <span>L</span>
              <span>A</span>
              <span>+</span>
            </div>
            <div>
              <b>+2.400 personas</b>
              <small>ya entrenan en Altura</small>
            </div>
            <span className="proof-divider" />
            <div className="rating">
              <span className="rating-stars" aria-label="Calificación 4.9 de 5">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} size={11} fill="currentColor" />
                ))}
              </span>
              <small>4.9 / 5</small>
            </div>
          </div>
        </div>
        <div className="hero-location">
          <MapPin size={14} /> Medellín, Colombia <span className="hero-location-dot" /> ☀️ 23°C{" "}
          <span className="hero-location-dot" /> Abierto hoy hasta las 11:00 p. m.
        </div>
        <div className="hero-scroll">
          DESLIZA PARA EXPLORAR <span />
        </div>
      </section>

      {/* Novedades e Instalaciones en Vivo */}
      <AthleticMarquee />

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
          <Link href="/portal/book" className="text-link">
            Ver todos los servicios <ArrowRight size={16} />
          </Link>
        </div>

        <div className="category-grid">
          {serviceCategories.map(({ slug, name, description, icon, tone, image }, index) => {
            const from = minPrice(initialCatalog, slug);
            return (
              <Link className="category-card" key={slug} href="/portal/book">
                <div className="category-media">
                  {image && (
                    <Image
                      src={image}
                      alt={name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="category-img"
                    />
                  )}
                  <div className="category-media-overlay" />
                  <div className="category-badge-floating">
                    <IconBox icon={categoryIcons[icon]} tone={tone} />
                  </div>
                  <span className="category-index-badge">0{index + 1}</span>
                </div>
                <div className="category-body">
                  <h3>{name}</h3>
                  <p>{description}</p>
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

      {/* Sección 5: Membresías & Planes de Acceso */}
      <MembershipsSection />

      {/* Sección 6: Agenda de Torneos & Vida en el Club */}
      <ClubEvents />

      {/* Sección 7 & 8: Tercer Tiempo (Lounge & Coworking) y Pase Digital QR */}
      <LifestyleAndDigitalPass />

      {/* Sección 9: Testimonios de Atletas & Socios */}
      <TestimonialsSection />

      {/* Sección 10: Preguntas Frecuentes y Políticas */}
      <FaqSection />

      

      {/* Footer Institucional Completo */}
      <InstitutionalFooter />
    </>
  );
}
