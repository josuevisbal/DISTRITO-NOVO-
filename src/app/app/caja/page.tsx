import { BarraStaff } from '@/components/barra-staff'
import { cargarCaja } from '@/lib/datos/caja'
import { exigirRol } from '@/lib/sesion'
import { CajaCliente } from './caja-cliente'

export const dynamic = 'force-dynamic'

/** Pantalla del puesto de caja (cajero). El panel tiene su propia vista en /app/admin/caja. */
export default async function PaginaCaja() {
  const staff = await exigirRol('cajero', 'admin')
  const datos = await cargarCaja(staff.restaurante_id)

  // El contenido respira como el panel del dueño: ancho máximo centrado y aire lateral,
  // en vez de pegarse a los bordes de la pantalla.
  return (
    <>
      <BarraStaff staff={staff} titulo="Caja" />
      <main className="mx-auto w-full max-w-[1150px] px-6 py-6 sm:px-8">
        <CajaCliente {...datos} servidorAhoraISO={new Date().toISOString()} />
      </main>
    </>
  )
}
