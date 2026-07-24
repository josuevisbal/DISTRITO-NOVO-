import type { Metadata } from 'next'
import { Cinzel, Inter } from 'next/font/google'

import './globals.css'

const fuenteTitulo = Cinzel({
  variable: '--fuente-titulo',
  subsets: ['latin'],
  weight: ['500', '700'],
})

const fuenteTexto = Inter({
  variable: '--fuente-texto',
  subsets: ['latin'],
})

// El nombre del restaurante nunca va aquí: cada ruta /[slug] genera su propio título.
export const metadata: Metadata = {
  title: 'Sistema de pedidos',
  description: 'Pedidos multicocina con disparo escalonado por estación',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${fuenteTitulo.variable} ${fuenteTexto.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
