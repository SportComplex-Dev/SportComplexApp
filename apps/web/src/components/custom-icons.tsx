import type { FC, SVGProps } from 'react'

export type CustomIconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

/** Fútbol - Balón clásico de fútbol con pentágono central y gajos */
export const FaSoccerIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="9.5" />
    <polygon points="12,8 15,10.2 13.8,13.8 10.2,13.8 9,10.2" fill="currentColor" fillOpacity="0.15" />
    <line x1="12" y1="8" x2="12" y2="2.5" />
    <line x1="15" y1="10.2" x2="20" y2="8" />
    <line x1="13.8" y1="13.8" x2="18.5" y2="18" />
    <line x1="10.2" y1="13.8" x2="5.5" y2="18" />
    <line x1="9" y1="10.2" x2="4" y2="8" />
  </svg>
)

/** Tenis - Pelota de tenis con costuras curvas parabólicas */
export const FaTennisBallIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="9.5" />
    {/* Costura izquierda */}
    <path d="M5.5 5.5 C9.8 8.2 9.8 15.8 5.5 18.5" />
    {/* Costura derecha */}
    <path d="M18.5 5.5 C14.2 8.2 14.2 15.8 18.5 18.5" />
  </svg>
)

/** Pádel - Pala de pádel con perforaciones circulares y empuñadura */
export const FaPadelIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Cabeza de la pala */}
    <rect x="5.5" y="2.5" width="13" height="12" rx="6.5" />
    {/* Perforaciones */}
    <circle cx="9.5" cy="6.5" r="0.8" fill="currentColor" />
    <circle cx="14.5" cy="6.5" r="0.8" fill="currentColor" />
    <circle cx="12" cy="8.5" r="0.8" fill="currentColor" />
    <circle cx="9.5" cy="10.5" r="0.8" fill="currentColor" />
    <circle cx="14.5" cy="10.5" r="0.8" fill="currentColor" />
    {/* Cuello y mango */}
    <path d="M10 14.5 L10 20.5 C10 21.3 10.7 22 11.5 22 H12.5 C13.3 22 14 21.3 14 20.5 L14 14.5" />
    {/* Cuerda de seguridad */}
    <path d="M12 22 C12 23 13 23.5 13.5 23" strokeWidth="1.2" />
  </svg>
)

/** Escalera de piscina (adultos) - Barandillas tubulares y peldaños */
export const FaWaterLadderIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Pasamanos izquierdo con curvatura superior */}
    <path d="M7 20 V8 C7 5.2 9 3 11.5 3 C12.8 3 13.5 3.8 13.5 5" />
    {/* Pasamanos derecho con curvatura superior */}
    <path d="M14 20 V10 C14 7.2 16 5 18.5 5 C19.8 5 20.5 5.8 20.5 7" />
    {/* Peldaños horizontales */}
    <line x1="7" y1="11" x2="14" y2="11" />
    <line x1="7" y1="15" x2="14" y2="15" />
    <line x1="7" y1="19" x2="14" y2="19" />
    {/* Onda de agua */}
    <path d="M2 21 C4.5 19.8 6.5 22.2 9 21 C11.5 19.8 13.5 22.2 16 21 C18.5 19.8 20.5 22.2 22 21" strokeWidth="1.4" />
  </svg>
)

/** Piscina de entrenamiento - Nadador braceando entre carriles */
export const FaPersonSwimmingPoolIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Cabeza del nadador */}
    <circle cx="17.5" cy="7.5" r="2" fill="currentColor" fillOpacity="0.2" />
    {/* Brazo y cuerpo en brazada de crol */}
    <path d="M6 13.5 L10.5 11 L14.5 11 L18.5 6" />
    <path d="M11 11 L9 14.5 L5 15" />
    {/* Líneas de agua / carril */}
    <path d="M2 17 C5 15.5 8 18.5 11 17 C14 15.5 17 18.5 20 17 C21 16.5 22 17 22 17" strokeWidth="1.5" />
    <path d="M2 21 C5 19.8 8 22.2 11 21 C14 19.8 17 22.2 20 21" strokeWidth="1.3" strokeOpacity="0.7" />
  </svg>
)

/** Piscina niños - Pistola de agua / Squirt gun */
export const FaGunSquirtIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Cañón y cuerpo de la pistola de agua */}
    <path d="M3 11 H16 V14.5 H13.5 L12 21 H8.5 L9.5 14.5 H4.5 L3 13 Z" />
    {/* Tanque de agua superior */}
    <path d="M7 8.5 C7 6.5 8.5 6.5 10 6.5 H13 C14.5 6.5 14.5 8.5 14.5 8.5" />
    {/* Gatillo */}
    <path d="M11 14.5 C11 16.5 12.5 16.5 12.5 14.5" />
    {/* Chorro y gotas de agua saliendo de la boquilla */}
    <line x1="17.5" y1="12.5" x2="20.5" y2="12.5" strokeWidth="2" />
    <circle cx="22" cy="12.5" r="0.9" fill="currentColor" />
  </svg>
)

/** Sauna - Ondas de calor seco */
export const FaHeatIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* 3 ondas verticales de calor ascendente */}
    <path d="M7 19 C5 15.5 9 12.5 7 9 C5.5 6.5 7.5 4.5 8 3" />
    <path d="M12 20 C10 16.5 14 13.5 12 10 C10.5 7.5 12.5 5.5 13 4" />
    <path d="M17 19 C15 15.5 19 12.5 17 9 C15.5 6.5 17.5 4.5 18 3" />
    {/* Base o piedras del calentador de sauna */}
    <line x1="4" y1="21.5" x2="20" y2="21.5" strokeWidth="2" />
  </svg>
)

/** Turco & Jacuzzi - Persona relajándose en la bañera / hidromasaje */
export const FaHotTubPersonIcon: FC<CustomIconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Cabeza de la persona */}
    <circle cx="12" cy="7.5" r="2.3" fill="currentColor" fillOpacity="0.2" />
    {/* Hombros apoyados en el borde */}
    <path d="M8 14 C8 11.5 10.5 10.5 12 10.5 C13.5 10.5 16 11.5 16 14" />
    {/* Tina / Jacuzzi */}
    <path d="M3 14.5 H21 V17.5 C21 19.8 19.2 21.5 17 21.5 H7 C4.8 21.5 3 19.8 3 17.5 Z" />
    {/* Vapores de agua caliente */}
    <path d="M6 7 C5 5.5 6.5 4 6 3" strokeWidth="1.4" />
    <path d="M18 7 C17 5.5 18.5 4 18 3" strokeWidth="1.4" />
  </svg>
)
