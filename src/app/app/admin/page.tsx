import { redirect } from 'next/navigation'

/** /app/admin a secas manda al Tablero, que es la portada del panel. */
export default function IndicePanel() {
  redirect('/app/admin/tablero')
}
