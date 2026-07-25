import { ConsultaCliente } from './consulta-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaConsulta({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ConsultaCliente slug={slug} />
}
