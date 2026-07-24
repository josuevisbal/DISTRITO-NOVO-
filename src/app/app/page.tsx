import { redirect } from 'next/navigation'

import { inicioDeRol, staffActual } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/** Reparte a cada quien a su pantalla según el rol. */
export default async function App() {
  const staff = await staffActual()
  if (!staff) redirect('/app/login')
  redirect(inicioDeRol(staff.rol))
}
