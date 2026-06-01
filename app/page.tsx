import { redirect } from 'next/navigation'

// Server component — redirige inmediatamente a /afinador (pantalla principal)
export default function RootPage() {
  redirect('/afinador')
}
