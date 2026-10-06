import { ForgotPasswordForm } from '@/components/forgot-password-form'

export const metadata = {
  title: 'Recuperar contraseña · AKROS SportComplex',
  description: 'Ingresa tu correo electrónico para recibir un enlace y restablecer tu contraseña.',
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
