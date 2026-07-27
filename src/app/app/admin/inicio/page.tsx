import { PestanasModulo } from '@/components/panel/pestanas-modulo'
import type { FrasesLanding } from '@/lib/datos/carta'
import { exigirRol } from '@/lib/sesion'
import { PESTANAS_MENU } from '../carta/page'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { InicioAdmin } from './inicio-admin'

export const dynamic = 'force-dynamic'

/** Módulo "Página de inicio": el admin cambia las fotos y las frases de la landing. */
export default async function PaginaAdminInicio() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('restaurantes')
    .select('slug, portada_url, foto_local_url, direccion, horario, whatsapp, landing')
    .eq('id', staff.restaurante_id)
    .maybeSingle()

  return (
    <div className="space-y-4">
      <PestanasModulo opciones={PESTANAS_MENU} activa="/app/admin/inicio" />
      <p className="text-sm text-marca-texto-suave">
        Lo que ve el cliente al abrir el link: las fotos y las frases de la pantalla de
        bienvenida. Lo que dejes vacío usa el texto de la plantilla.
      </p>
      <InicioAdmin
        slug={data?.slug ?? ''}
        portadaUrl={data?.portada_url ?? null}
        fotoLocalUrl={data?.foto_local_url ?? null}
        direccion={data?.direccion ?? ''}
        horario={data?.horario ?? ''}
        whatsapp={data?.whatsapp ?? ''}
        frases={(data?.landing ?? {}) as FrasesLanding}
      />
    </div>
  )
}
