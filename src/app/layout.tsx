import type { Metadata, Viewport } from 'next'
import { Cinzel, Cinzel_Decorative, Dancing_Script, Inter } from 'next/font/google'

import { MARCA } from '@/config/tema'

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

// Script para los detalles cursivos de la landing ("Del carbón a tu mesa").
const fuenteScript = Dancing_Script({
  variable: '--fuente-script',
  subsets: ['latin'],
  weight: ['600', '700'],
})

const fuenteTexto = Inter({
  variable: '--fuente-texto',
  subsets: ['latin'],
})

// El nombre del restaurante nunca va aquí: cada ruta /[slug] genera su propio título.
export const metadata: Metadata = {
  title: 'Sistema de pedidos',
  description: 'Pedidos multicocina: cada estación recibe su comanda al instante',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pedidos' },
}

export const viewport: Viewport = {
  themeColor: MARCA.dorado,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${fuenteTitulo.variable} ${fuenteLogo.variable} ${fuenteScript.variable} ${fuenteTexto.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
