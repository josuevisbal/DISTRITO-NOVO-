import type { Metadata, Viewport } from 'next'
import { Cinzel, Cinzel_Decorative, Inter } from 'next/font/google'

import './globals.css'

const fuenteTitulo = Cinzel({
  variable: '--fuente-titulo',
  subsets: ['latin'],
  weight: ['500', '700'],
})

// Fuente labrada solo para el logotipo, evocando la carta impresa.
const fuenteLogo = Cinzel_Decorative({
  variable: '--fuente-logo',
  subsets: ['latin'],
  weight: ['700', '900'],
})

const fuenteTexto = Inter({
  variable: '--fuente-texto',
  subsets: ['latin'],
})

// El nombre del restaurante nunca va aquí: cada ruta /[slug] genera su propio título.
export const metadata: Metadata = {
  title: 'Sistema de pedidos',
  description: 'Pedidos multicocina con disparo escalonado por estación',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pedidos' },
}

export const viewport: Viewport = {
  themeColor: '#B8862B',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${fuenteTitulo.variable} ${fuenteLogo.variable} ${fuenteTexto.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
