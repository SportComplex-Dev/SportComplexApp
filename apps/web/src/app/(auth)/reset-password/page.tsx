import { ResetPasswordForm } from '@/components/reset-password-form'

export const metadata = {
  title: 'Restablecer contraseña · AKROS SportComplex',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string; error?: string }>
}) {
  const { recovery, error } = await searchParams
  return (
    <ResetPasswordForm
      isSupabaseRecovery={recovery === '1'}
      initialError={error}
    />
  )
}
