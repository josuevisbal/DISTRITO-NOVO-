import type { NextRequest } from 'next/server'

import { actualizarSesion } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return actualizarSesion(request)
}

export const config = {
  // Corre en todo menos archivos estáticos, imágenes, video, audio, fuentes, el manifiesto
  // y el service worker: ninguno necesita sesión y cada uno era una ejecución de más.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mp3|woff2?|ttf|webmanifest)$).*)',
  ],
}
