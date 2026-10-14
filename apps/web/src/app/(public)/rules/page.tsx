'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  Lock,
  QrCode,
  Scale,
  ShieldCheck,
  Trophy,
  Users,
  Waves,
} from 'lucide-react';

interface RuleModule {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  lawBadge?: string;
  rulesBadge?: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  highlights: string[];
  articles: {
    number: string;
    title: string;
    content: string;
    ruleCode?: string;
  }[];
}

const RULE_MODULES: RuleModule[] = [
  {
    id: 'acceso-qr',
    number: '01',
    title: 'Acceso, Identificación y Pase Digital QR',
    subtitle: 'Protocolos de ingreso, validación biométrica y acreditación criptográfica en torniquetes.',
    rulesBadge: 'RN-14',
    icon: QrCode,
    highlights: [
      'Presentación obligatoria del código QR criptográfico (SC1) en portería y molinetes.',
      'Credenciales personales e intransferibles supervisadas por el rol Empleado_Lector.',
      'Control de aforo por franja horaria activa y bloqueo ante pases vencidos o alterados.',
    ],
    articles: [
      {
        number: 'Art. 1.1',
        title: 'Credencial Digital Obligatoria (RN-14)',
        content:
          'Todo socio, deportista o invitado debe presentar su Pase Digital con código QR criptográfico firmado (estándar SC1) generado desde el portal oficial. El ingreso a áreas deportivas está condicionado a la validación exitosa por parte de los torniquetes automatizados o del personal con rol Empleado_Lector.',
        ruleCode: 'RN-14',
      },
      {
        number: 'Art. 1.2',
        title: 'Intransferibilidad del Pase',
        content:
          'Los pases digitales y membresías son estrictamente individuales e intransferibles. El préstamo o cesión no autorizada de credenciales constituye una falta grave que acarreará la suspensión temporal de la cuenta y la anulación inmediata de la reserva sin derecho a reembolso.',
      },
      {
        number: 'Art. 1.3',
        title: 'Ventana de Tolerancia y Permanencia',
        content:
          'El acceso se habilita hasta 15 minutos antes de la hora de inicio de la reserva y se mantiene vigente durante el lapso contratado. La permanencia en zonas deportivas después de culminado el turno requiere autorización expresa o una reserva consecutiva confirmada.',
      },
    ],
  },
  {
    id: 'canchas-deportivas',
    number: '02',
    title: 'Uso de Canchas e Instalaciones (Pádel, Tenis y Fútbol)',
    subtitle: 'Normas de indumentaria, tiempo de gracia y preservación de superficies de alto rendimiento.',
    icon: Trophy,
    highlights: [
      'Calzado deportivo con suela no marcante (clay/omni) obligatorio para polvo de ladrillo y pádel.',
      'Tiempo de gracia de 10 minutos; transcurrido este plazo se declara abandono de turno.',
      'Prohibido el ingreso de calzado con taches metálicos en canchas de césped sintético FIFA.',
    ],
    articles: [
      {
        number: 'Art. 2.1',
        title: 'Calzado y Equipamiento Reglamentario',
        content:
          'Para el uso de pistas de tenis en polvo de ladrillo y pistas panorámicas de pádel es mandatorio portar calzado especializado con suela espiga o sin relieve abrasivo que garantice la preservación de la superficie. En las canchas de fútbol sintético está prohibido el uso de taches de aluminio o metal.',
      },
      {
        number: 'Art. 2.2',
        title: 'Tiempo de Gracia y Abandono de Cancha',
        content:
          'Los jugadores disponen de un tiempo de gracia de diez (10) minutos a partir de la hora fijada para la reserva. Vencido este margen sin que se haya presentado el titular o al menos dos (2) participantes registrados, el sistema declarará el turno en abandono (no-show) y el club podrá disponer de la cancha sin obligación de reintegro.',
      },
      {
        number: 'Art. 2.3',
        title: 'Preservación de Estructuras y Vidrios Panorámicos',
        content:
          'Se prohíbe golpear deliberadamente con palas, raquetas o balones los cristales templados de pádel, las mallas perimetrales o los postes de red. Cualquier daño ocasionado por conducta imprudente o antirreglamentaria será asumido en su totalidad por el titular de la reserva.',
      },
    ],
  },
  {
    id: 'piscinas-ley-1209',
    number: '03',
    title: 'Seguridad y Normativa en Piscinas (Ley 1209 de 2008)',
    subtitle: 'Cumplimiento estricto de la legislación colombiana de seguridad en piscinas y zonas húmedas.',
    lawBadge: 'Ley 1209 de 2008',
    rulesBadge: 'RN-02',
    icon: Waves,
    highlights: [
      'Uso obligatorio de gorro de natación y ducha previa de al menos 1 minuto.',
      'Supervisión obligatoria y permanente de adultos sobre menores de 12 años.',
      'Cierre programado por mantenimiento químico y desinfección los lunes no festivos (RN-02).',
    ],
    articles: [
      {
        number: 'Art. 3.1',
        title: 'Marco Regulatorio y Salubridad (Ley 1209 de 2008)',
        content:
          'De conformidad con la Ley 1209 de 2008 de la República de Colombia, el complejo acuático dispone de salvavidas certificados, sensores perimetrales y botiquín de primeros auxilios. Es obligatorio el uso de gorro de baño y la ducha corporal previa completa antes de ingresar al agua para mantener los estándares fisicoquímicos.',
      },
      {
        number: 'Art. 3.2',
        title: 'Protección de Menores de Edad',
        content:
          'Los menores de doce (12) años deben ingresar y permanecer en la zona de piscinas acompañados por un padre, tutor o adulto responsable que asuma su supervisión directa en todo momento. Quedan prohibidos los clavados, carreras en bordillos resbaladizos y juegos de inmersión riesgosa.',
      },
      {
        number: 'Art. 3.3',
        title: 'Jornadas de Desinfección y Mantenimiento (RN-02)',
        content:
          'El complejo acuático suspende operaciones todos los días lunes hábiles (o el martes siguiente cuando el lunes sea festivo oficial) para ejecutar protocolos de hipercloración, recirculación y mantenimiento preventivo estipulados en la regla RN-02.',
        ruleCode: 'RN-02',
      },
    ],
  },
  {
    id: 'reservas-cashless',
    number: '04',
    title: 'Políticas de Reserva, Cancelación y Modelo Cashless',
    subtitle: 'Transacciones 100% digitales vía Stripe, bloqueo anti-colisión y beneficios de socios.',
    rulesBadge: 'RN-01 • RN-08 • RN-13',
    icon: CreditCard,
    highlights: [
      'Modelo 100% Cashless: no se recibe efectivo en ventanilla ni taquilla física (RN-13).',
      'Bloqueo transaccional de 30 minutos anti-colisión para reservas en proceso (RN-01, RN-07).',
      'Descuento del 30% en reservas para socios con membresía vigente (RN-08).',
      'Cancelaciones y reprogramaciones válidas con mínimo 12 horas de antelación.',
    ],
    articles: [
      {
        number: 'Art. 4.1',
        title: 'Operación 100% Cashless (RN-13)',
        content:
          'AKROS opera bajo un esquema exclusivamente digital mediante la pasarela de pagos Stripe. No se procesa dinero en efectivo en taquillas, cafetería ni tiendas del club. Todos los pagos de reservas, membresías e inscripciones deben completarse con tarjeta de crédito/débito o billetera digital.',
        ruleCode: 'RN-13',
      },
      {
        number: 'Art. 4.2',
        title: 'Bloqueo Provisional Anti-Colisión (RN-01 / RN-07)',
        content:
          'Al iniciar el flujo de reserva, el sistema retiene la franja seleccionada durante 30 minutos para evitar reservas concurrentes duplicadas. Si la transacción de pago no se perfecciona en dicho lapso, la franja se libera automáticamente para el catálogo general.',
        ruleCode: 'RN-01',
      },
      {
        number: 'Art. 4.3',
        title: 'Tarifas Diferenciales para Socios (RN-08)',
        content:
          'Los socios con suscripción mensual, trimestral o anual activa disfrutan de un 30% de descuento automático en la tarifa estándar de canchas y servicios complementarios, reflejado de forma instantánea al autenticarse en el portal.',
        ruleCode: 'RN-08',
      },
      {
        number: 'Art. 4.4',
        title: 'Política de Cancelaciones y Reprogramaciones',
        content:
          'El usuario puede cancelar o reprogramar su turno con un mínimo de doce (12) horas de antelación respecto a la hora reservada, recibiendo crédito íntegro en su cuenta para futuras reservas. Las cancelaciones con menos de 12 horas conllevan el cobro total del turno por imposibilidad de reasignación.',
      },
    ],
  },
  {
    id: 'convivencia-ley-1801',
    number: '05',
    title: 'Convivencia, Seguridad y Salud (Código de Convivencia)',
    subtitle: 'Normas de respeto mutuo, salud pública y exoneración médica voluntaria.',
    lawBadge: 'Ley 1801 de 2016',
    icon: Users,
    highlights: [
      'Cero tolerancia con armas, cigarrillos, vapeadores y bebidas alcohólicas.',
      'Declaración obligatoria de aptitud física para práctica de alta exigencia.',
      'Juego limpio, respeto a los árbitros, rivales y personal de soporte.',
    ],
    articles: [
      {
        number: 'Art. 5.1',
        title: 'Prohibición de Sustancias y Armas (Ley 1801 de 2016)',
        content:
          'En observancia del Código Nacional de Seguridad y Convivencia Ciudadana (Ley 1801 de 2016), se prohíbe terminantemente el ingreso de armas de cualquier tipo, cigarrillos tradicionales, cigarrillos electrónicos (vapeadores), sustancias psicoactivas o bebidas alcohólicas en todas las instalaciones del complejo.',
      },
      {
        number: 'Art. 5.2',
        title: 'Declaración Voluntaria de Aptitud Física',
        content:
          'Al reservar o ingresar a las instalaciones de AKROS, cada usuario declara bajo gravedad de juramento hallarse en condiciones médicas y físicas adecuadas para la práctica deportiva. El club no asume responsabilidad civil ni médica por dolencias preexistentes o sobreesfuerzos no reportados.',
      },
      {
        number: 'Art. 5.3',
        title: 'Conducta Deportiva y Juego Limpio',
        content:
          'Los socios y usuarios deben mantener una actitud respetuosa hacia los demás deportistas, árbitros y personal operativo. Los actos de discriminación, agresiones verbales o riñas derivarán en la expulsión inmediata y veto de las instalaciones conforme a los estatutos del club.',
      },
    ],
  },
  {
    id: 'datos-ley-1581',
    number: '06',
    title: 'Protección de Datos Personales y Videovigilancia',
    subtitle: 'Política de tratamiento de datos personales conforme al régimen de Habeas Data colombiano.',
    lawBadge: 'Ley 1581 de 2012',
    icon: Lock,
    highlights: [
      'Tratamiento de datos personales amparado bajo la Ley Estatutaria 1581 de 2012.',
      'Sistema de videovigilancia CCTV exclusivo para fines de seguridad patrimonial.',
      'Canales directos para consulta, corrección y supresión de datos personales.',
    ],
    articles: [
      {
        number: 'Art. 6.1',
        title: 'Tratamiento y Habeas Data (Ley 1581 de 2012)',
        content:
          'AKROS Club Deportivo S.A.S. actúa como responsable del tratamiento de los datos personales suministrados en el proceso de registro y pago. La información se almacena con cifrado bancario y se utiliza exclusivamente para la gestión de reservas, control de acceso QR y notificaciones del servicio.',
      },
      {
        number: 'Art. 6.2',
        title: 'Circuito Cerrado de Televisión (CCTV)',
        content:
          'Las áreas comunes, accesos, pasillos y escenarios deportivos se encuentran monitoreados permanentemente mediante cámaras de seguridad señalizadas. Las grabaciones son confidenciales y se conservan de acuerdo con los plazos legales vigentes para esclarecimiento de incidentes de seguridad.',
      },
      {
        number: 'Art. 6.3',
        title: 'Ejercicio de Derechos ARCO',
        content:
          'Cualquier titular de información puede ejercer sus derechos de acceso, rectificación, actualización y supresión de datos personales dirigiendo su solicitud formal al correo institucional privacidad@akrosclub.co o a través del área de Conserjería Deportiva.',
      },
    ],
  },
];

export default function RulesPage() {
  const shouldReduceMotion = useReducedMotion();
  // Inicialmente abrimos el primer módulo para guiar al usuario
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    'acceso-qr': true,
  });
  const [notification, setNotification] = useState<string | null>(null);

  const toggleModule = (id: string) => {
    setOpenModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allOpen: Record<string, boolean> = {};
    RULE_MODULES.forEach((m) => {
      allOpen[m.id] = true;
    });
    setOpenModules(allOpen);
  };

  const collapseAll = () => {
    setOpenModules({});
  };

  const handleDownloadPdf = () => {
    if (typeof window !== 'undefined') {
      // Activa el cuadro de impresión nativo del navegador configurado para documento/PDF
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setNotification('Enlace copiado al portapapeles');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12">
      {/* ─────────────────────────────────────────────────────────────
          A. ENCABEZADO INSTITUCIONAL (HERO NORMATIVO)
          ───────────────────────────────────────────────────────────── */}
      <header className="mb-10 text-center sm:text-left">
        {/* Badge superior temático */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#123e30]/15 dark:border-[#c9ef75]/30 bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-xs font-semibold uppercase tracking-wider text-[#123e30] dark:text-[#c9ef75] mb-4">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-[#c9ef75] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c9ef75]" />
          </span>
          <span>MARCO LEGAL Y DE CONVIVENCIA • AKROS CLUB</span>
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#121a16] dark:text-[#f2f5f1] tracking-tight mb-3">
          Reglamento Interno y Términos de Convivencia Deportiva
        </h1>

        {/* Subtítulo Descriptivo */}
        <p className="text-base sm:text-lg text-[#526058] dark:text-[#9eaba3] leading-relaxed max-w-3xl">
          Normativa aplicable a socios, usuarios e invitados en Sede El Poblado y Sede Laureles
          (Medellín, Colombia). Diseñado para garantizar la seguridad, el juego limpio y la
          experiencia de alto nivel en todas nuestras instalaciones.
        </p>

        {/* Metadatos y Barra de Acciones */}
        <div className="mt-6 pt-4 border-t border-[#e2e6df] dark:border-[#26352d] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-[#526058] dark:text-[#9eaba3]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#123e30] dark:text-[#c9ef75]">
              <Scale className="w-4 h-4" aria-hidden="true" />
              Versión 2.0 • Octubre 2026
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">6 Módulos Oficiales</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c9ef75] hover:bg-[#d6f694] text-[#123e30] font-bold text-xs uppercase tracking-wider shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2"
              title="Descargar o imprimir normativa en formato PDF"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Descargar Normativa PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2e6df] dark:border-[#26352d] hover:bg-white dark:hover:bg-[#15201b] text-xs font-semibold text-[#526058] dark:text-[#9eaba3] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2"
              title="Copiar enlace a los reglamentos"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Compartir</span>
            </button>
          </div>
        </div>

        {notification && (
          <div
            role="status"
            className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-all text-center"
          >
            {notification}
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          CONTROLES DE VISUALIZACIÓN DE ACORDEONES
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#e2e6df]/80 dark:border-[#26352d]/80">
        <span className="text-xs font-bold uppercase tracking-wider text-[#526058] dark:text-[#9eaba3]">
          ESTRUCTURA NORMATIVA DEL COMPLEJO
        </span>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1 rounded-lg text-[#123e30] dark:text-[#c9ef75] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75]"
          >
            Expandir todos
          </button>
          <span className="text-[#526058] dark:text-[#9eaba3]">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1 rounded-lg text-[#526058] dark:text-[#9eaba3] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75]"
          >
            Colapsar todos
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          B. MÓDULOS NORMATIVOS DESPLEGABLES (ACORDEONES)
          ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {RULE_MODULES.map((module) => {
          const isOpen = !!openModules[module.id];
          const IconComponent = module.icon;
          const buttonId = `module-btn-${module.id}`;
          const contentId = `module-content-${module.id}`;

          return (
            <section
              key={module.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'border-[#123e30]/30 dark:border-[#c9ef75]/40 bg-white dark:bg-[#15201b] shadow-lg'
                  : 'border-[#e2e6df] dark:border-[#26352d] bg-[#f7f8f5]/60 dark:bg-[#111815]/40 hover:bg-white dark:hover:bg-[#15201b]'
              }`}
            >
              {/* Encabezado del Acordeón (Botón Interactivo) */}
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-start sm:items-center justify-between gap-4 p-5 sm:p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e30] dark:focus-visible:ring-[#c9ef75] focus-visible:ring-offset-2 transition-colors cursor-pointer"
              >
                <div className="flex items-start sm:items-center gap-4">
                  {/* Icono temático */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? 'bg-[#c9ef75] text-[#123e30]'
                        : 'bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-[#123e30] dark:text-[#c9ef75]'
                    }`}
                  >
                    <IconComponent className="w-6 h-6" aria-hidden="true" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-[#526058] dark:text-[#9eaba3]">
                        MÓDULO {module.number}
                      </span>
                      {module.lawBadge && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          {module.lawBadge}
                        </span>
                      )}
                      {module.rulesBadge && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                          {module.rulesBadge}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#121a16] dark:text-[#f2f5f1]">
                      {module.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#526058] dark:text-[#9eaba3] mt-0.5">
                      {module.subtitle}
                    </p>
                  </div>
                </div>

                {/* Flecha indicadora de estado */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-[#123e30] dark:text-[#c9ef75] transition-transform duration-200 ${
                    isOpen ? 'rotate-180 bg-[#c9ef75]/30' : ''
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDown className="w-5 h-5" />
                </div>
              </button>

              {/* Contenido Desplegable Animado */}
              <motion.div
                id={contentId}
                role="region"
                aria-labelledby={buttonId}
                initial={false}
                animate={{
                  height: isOpen ? 'auto' : 0,
                  opacity: isOpen ? 1 : 0,
                }}
                transition={{
                  duration: shouldReduceMotion ? 0.05 : 0.25,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="overflow-hidden"
              >
                <div className="p-5 sm:p-6 pt-0 border-t border-[#e2e6df] dark:border-[#26352d]/60 mt-2">
                  {/* Puntos destacados / Key Takeaways */}
                  <div className="mb-6 p-4 rounded-xl bg-[#f7f8f5] dark:bg-[#1a2620] border border-[#e2e6df] dark:border-[#26352d]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#123e30] dark:text-[#c9ef75] block mb-2">
                      Puntos Clave del Módulo
                    </span>
                    <ul className="space-y-1.5">
                      {module.highlights.map((highlight, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs sm:text-sm text-[#526058] dark:text-[#9eaba3]"
                        >
                          <ShieldCheck
                            className="w-4 h-4 text-[#123e30] dark:text-[#c9ef75] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Artículos reglamentarios detallados */}
                  <div className="space-y-4">
                    {module.articles.map((article, artIdx) => (
                      <div
                        key={artIdx}
                        className="p-4 rounded-xl border border-[#e2e6df]/70 dark:border-[#26352d]/70 bg-white/70 dark:bg-[#131d18]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h3 className="text-sm font-bold text-[#121a16] dark:text-[#f2f5f1]">
                            <span className="text-[#123e30] dark:text-[#c9ef75] mr-1.5">
                              {article.number}
                            </span>
                            {article.title}
                          </h3>
                          {article.ruleCode && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#123e30]/5 dark:bg-[#c9ef75]/10 text-[#123e30] dark:text-[#c9ef75] font-semibold">
                              {article.ruleCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-[#526058] dark:text-[#9eaba3] leading-relaxed">
                          {article.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </section>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TARJETA DE CONTACTO Y RESOLUCIÓN DE DUDAS
          ───────────────────────────────────────────────────────────── */}
      <div className="mt-12 p-6 sm:p-8 rounded-3xl border border-[#e2e6df] dark:border-[#26352d] bg-white dark:bg-[#15201b] shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-[#121a16] dark:text-[#f2f5f1]">
            ¿Tienes inquietudes sobre la aplicación del reglamento?
          </h3>
          <p className="text-xs sm:text-sm text-[#526058] dark:text-[#9eaba3] mt-1 max-w-xl">
            El Comité de Convivencia y la Dirección de Operaciones de AKROS están a tu disposición
            para resolver cualquier duda sobre normativas de juego, reservas o sanciones.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/portal/book"
            className="px-4 py-2.5 rounded-xl border border-[#e2e6df] dark:border-[#26352d] hover:bg-[#f7f8f5] dark:hover:bg-[#1a2620] text-xs font-bold text-[#121a16] dark:text-[#f2f5f1] transition-all"
          >
            Ir a Reservas
          </Link>
          <a
            href="https://wa.me/573001234567"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-[#c9ef75] hover:bg-[#d6f694] text-[#123e30] font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            Contactar Conserjería
          </a>
        </div>
      </div>
    </div>
  );
}
