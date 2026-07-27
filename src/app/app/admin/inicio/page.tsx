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
    .select(
      'slug, logo_url, portada_url, foto_local_url, hero_video_url, direccion, horario, whatsapp, whatsapp_pedidos, llave_pago, cuenta_pago, landing',
    )
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
        logoUrl={data?.logo_url ?? null}
        portadaUrl={data?.portada_url ?? null}
        fotoLocalUrl={data?.foto_local_url ?? null}
        heroVideoUrl={data?.hero_video_url ?? null}
        direccion={data?.direccion ?? ''}
        horario={data?.horario ?? ''}
        whatsapp={data?.whatsapp ?? ''}
        whatsappPedidos={data?.whatsapp_pedidos ?? ''}
        llavePago={data?.llave_pago ?? ''}
        cuentaPago={data?.cuenta_pago ?? ''}
        frases={(data?.landing ?? {}) as FrasesLanding}
      />
    </div>
  )
}
