'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Coffee, QrCode, ScanLine, ShieldCheck, Utensils, Wifi, Zap } from 'lucide-react'

export function LifestyleAndDigitalPass() {
  return (
    <section className="section-shell lifestyle-and-tech-section">
      <div className="lifestyle-grid">
        {/* Columna Izquierda: El Tercer Tiempo (Gastronomía & Coworking) */}
        <div className="lifestyle-card">
          <div className="lifestyle-media">
            <Image
              src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80"
              alt="AKROS Club Lounge y Café Saludable"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="lifestyle-img object-cover"
            />
            <div className="lifestyle-media-overlay" />
            <div className="lifestyle-media-badge">
              <Coffee size={14} className="text-brand-lime" /> SPORTS BAR & HEALTHY LOUNGE
            </div>
          </div>

          <div className="lifestyle-content">
            <div className="eyebrow">TERCER TIEMPO</div>
            <h3>El partido no termina en la cancha.</h3>
            <p>
              Un espacio social diseñado para descansar, alimentarte bien y conectar con otros socios.
              Disfruta de café de especialidad antioqueño, smoothies de recuperación muscular,
              bowls balanceados y cócteles sin alcohol o cerveza artesanal al caer la tarde.
            </p>

            <div className="lifestyle-features">
              <div className="lifestyle-feature-item">
                <div className="lifestyle-icon-box">
                  <Utensils size={16} />
                </div>
                <div>
                  <strong>Nutrición Consciente</strong>
                  <small>Menú diseñado por nutricionistas deportivos para pre y post entrenamiento.</small>
                </div>
              </div>

              <div className="lifestyle-feature-item">
                <div className="lifestyle-icon-box">
                  <Wifi size={16} />
                </div>
                <div>
                  <strong>Coworking Deportivo</strong>
                  <small>Fibra óptica de alta velocidad y enchufes para responder correos con vistas a las pistas.</small>
                </div>
              </div>
            </div>

            <Link href="/portal/book" className="lifestyle-learn-more">
              Conocer el menú y servicios de la terraza <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* Columna Derecha: Tecnología & Pase Digital QR */}
        <div className="tech-card">
          <div className="tech-badge-top">
            <Zap size={14} className="text-brand-lime" /> ACCESO DIGITAL INTELIGENTE
          </div>

          <div className="eyebrow">TECNOLOGÍA SIN FRICCIÓN</div>
          <h3>Tu club en la palma de tu mano.</h3>
          <p>
            Olvida los carnets físicos o las filas de recepción. Todas tus reservas y membresías
            generan un comprobante con código QR criptográfico (RN-14 / RNF-05) que valida tu acceso en portería.
          </p>

          {/* Mockup de Pase Digital */}
          <div className="digital-ticket-mockup">
            <div className="ticket-mockup-header">
              <div className="ticket-brand-chip">
                <Image src="/images/Akros-logo.png" alt="AKROS" width={22} height={20} />
                <span>AKROS PASS</span>
              </div>
              <span className="ticket-status-pill">
                <ShieldCheck size={12} /> ACTIVO
              </span>
            </div>

            <div className="ticket-mockup-body">
              <div className="ticket-qr-frame">
                <QrCode size={105} strokeWidth={1.5} className="ticket-qr-svg" />
                <div className="ticket-qr-scan-line" />
              </div>
              <div className="ticket-details">
                <span className="ticket-service-name">Cancha de Pádel Panorámica 1</span>
                <span className="ticket-datetime">Hoy · 07:00 PM – 08:30 PM</span>
                <span className="ticket-user">Socio: Sebastián A. · Sede Poblado</span>
                <small className="ticket-code">TKT-AKR-2026-8841</small>
              </div>
            </div>

            <div className="ticket-mockup-foot">
              <ScanLine size={14} className="text-brand-lime animate-pulse" />
              <span>Presenta este código en el torniquete o lector de taquilla</span>
            </div>
          </div>

          <div className="tech-actions">
            <Link href="/scanner" className="action-button">
              <ScanLine size={16} /> Probar Escáner de Taquilla
            </Link>
            <Link href="/portal/tickets" className="hero-secondary text-sm">
              Ver mis tiquetes activos
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
