'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Clock, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react'

export function InstitutionalFooter() {
  return (
    <footer className="institutional-footer">
      <div className="section-shell">
        {/* Fila Superior: Tarjetas de Sedes Físicas */}
        <div className="footer-sedes-grid">
          <div className="footer-sede-card">
            <div className="footer-sede-header">
              <span className="footer-sede-dot" />
              <div>
                <h4>Sede El Poblado</h4>
                <span className="footer-sede-type">Club Principal · Pádel, Tenis & Fútbol</span>
              </div>
            </div>
            <div className="footer-sede-details">
              <p><MapPin size={14} className="text-brand-lime shrink-0" /> Cl. 10 #28-40, El Poblado, Medellín</p>
              <p><Clock size={14} className="text-brand-lime shrink-0" /> Lun - Sáb: 06:00 AM – 11:00 PM · Dom & Fest: 07:00 AM – 09:00 PM</p>
            </div>
          </div>

          <div className="footer-sede-card">
            <div className="footer-sede-header">
              <span className="footer-sede-dot" />
              <div>
                <h4>Sede Laureles</h4>
                <span className="footer-sede-type">Centro Acuático, Gimnasio & Wellness</span>
              </div>
            </div>
            <div className="footer-sede-details">
              <p><MapPin size={14} className="text-brand-lime shrink-0" /> Av. Nutibara #72-15, Laureles, Medellín</p>
              <p><Clock size={14} className="text-brand-lime shrink-0" /> Lun - Sáb: 05:30 AM – 10:30 PM · Dom & Fest: 07:00 AM – 08:00 PM</p>
            </div>
          </div>
        </div>

        {/* Separador de Cancha */}
        <div className="court-line-divider" />

        {/* Grilla Principal de Enlaces y Marca */}
        <div className="footer-main-grid">
          <div className="footer-brand-col">
            <div className="footer-brand-lockup">
              <Image
                src="/images/Akros-logo.png"
                alt="AKROS Active Lifestyle Club"
                width={36}
                height={30}
                className="footer-brand-logo"
                style={{ width: 'auto', height: 'auto' }}
              />
              <div>
                <b className="footer-brand-title">AKROS</b>
                <span className="footer-brand-sub">ACTIVE LIFESTYLE CLUB</span>
              </div>
            </div>
            <p className="footer-brand-desc">
              Espacio integral para el rendimiento deportivo, la salud y la comunidad activa.
              Instalaciones de alto nivel en Medellín, Colombia.
            </p>
            <div className="footer-contact-actions">
              <a
                href="https://wa.me/573001234567"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-whatsapp-btn"
              >
                <MessageCircle size={15} /> Conserjería WhatsApp
              </a>
              <span className="footer-tel">
                <Phone size={13} /> +57 (4) 444 8920
              </span>
            </div>
          </div>

          <div className="footer-nav-col">
            <span className="footer-col-title">Instalaciones</span>
            <ul>
              <li><Link href="/portal/book">Pádel Panorámico</Link></li>
              <li><Link href="/portal/book">Tenis Polvo de Ladrillo</Link></li>
              <li><Link href="/portal/book">Fútbol Sintético FIFA</Link></li>
              <li><Link href="/portal/book">Piscina Climatizada 28°C</Link></li>
              <li><Link href="/portal/book">Gimnasio & Biomecánica</Link></li>
              <li><Link href="/portal/book">Sauna, Turco & Jacuzzi</Link></li>
            </ul>
          </div>

          <div className="footer-nav-col">
            <span className="footer-col-title">Club & Experiencia</span>
            <ul>
              <li><Link href="/portal/book">Tarifas y Reservas</Link></li>
              <li><Link href="/portal/membership">Planes de Membresía</Link></li>
              <li><Link href="/portal/book">Agenda de Torneos</Link></li>
              <li><Link href="/portal/tickets">Mis Pases Digitales QR</Link></li>
              <li><Link href="/legal">Reglamentos Institucionales</Link></li>
            </ul>
          </div>

          <div className="footer-nav-col">
            <span className="footer-col-title">Plataforma & Staff</span>
            <ul>
              <li><Link href="/login">Acceso de Usuarios</Link></li>
              <li><Link href="/pos">Punto de Venta (Taquilla POS)</Link></li>
              <li><Link href="/scanner">Escáner de Torniquetes</Link></li>
              <li><Link href="/admin/dashboard">Panel de Administración</Link></li>
              <li><Link href="/admin/services">Control de Pistas</Link></li>
            </ul>
          </div>
        </div>

        {/* Barra Inferior Legal & Seguridad */}
        <div className="footer-bottom-bar">
          <div className="footer-legal-copy">
            <span>© 2026 AKROS Club Deportivo S.A.S. Todos los derechos reservados.</span>
            <Link href="/legal" className="hover:underline">Reglamentos y Condiciones</Link>
            <span>Medellín, Antioquia, Colombia.</span>
          </div>

          <div className="footer-security-badges">
            <span><ShieldCheck size={14} className="text-brand-lime" /> Modelo 100% Cashless (Stripe)</span>
            <span>Acceso seguro con QR dinámico</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
