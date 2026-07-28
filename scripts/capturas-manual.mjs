/**
 * Toma las capturas reales que ilustran el manual de uso.
 * Uso: node scripts/capturas-manual.mjs   (con el servidor de desarrollo corriendo)
 *
 * No forma parte de la app: es una herramienta para regenerar el manual cuando la
 * interfaz cambie. Las imágenes quedan en scripts/capturas/.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const SALIDA = new URL('./capturas/', import.meta.url).pathname.replace(/^\//, '')
mkdirSync(SALIDA, { recursive: true })

const CUENTAS = {
  dueno: { correo: 'admin@distrito.test', clave: 'distrito2026' },
  cajero: { correo: 'cajero@distrito.test', clave: 'distrito2026' },
  cocina: { correo: 'cocina@distrito.test', clave: 'distrito2026' },
  pase: { correo: 'pase@distrito.test', clave: 'distrito2026' },
  mesero: { correo: 'mesero@distrito.test', clave: 'distrito2026' },
  domi: { correo: 'domi@distrito.test', clave: 'distrito2026' },
}

async function entrar(page, cuenta) {
  await page.goto(`${BASE}/app/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', cuenta.correo)
  await page.fill('input[type="password"]', cuenta.clave)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
}

async function foto(page, ruta, nombre, { movil = false, espera = 1800 } = {}) {
  await page.setViewportSize(movil ? { width: 420, height: 900 } : { width: 1280, height: 900 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(espera)
  await page.screenshot({ path: `${SALIDA}${nombre}.jpg`, type: 'jpeg', quality: 72, fullPage: false })
  console.log('✓', nombre)
}

const navegador = await chromium.launch()

// ---------- Cliente (sin sesión) ----------
{
  const ctx = await navegador.newContext({ deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await foto(page, '/distrito-novo', 'cliente-1-bienvenida', { movil: true })
  await foto(page, '/distrito-novo/menu', 'cliente-2-menu', { movil: true })

  // Carrito con algo adentro
  await page.setViewportSize({ width: 420, height: 900 })
  await page.goto(`${BASE}/distrito-novo/menu`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const agregar = page.locator('main button', { hasText: /^Agregar/ }).first()
  if (await agregar.count()) {
    await agregar.click()
    await page.waitForTimeout(600)
    await page.locator('button', { hasText: 'Ver pedido' }).first().click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${SALIDA}cliente-3-carrito.jpg`, type: 'jpeg', quality: 72 })
    console.log('✓ cliente-3-carrito')
  }
  await ctx.close()
}

// ---------- Equipo ----------
const pantallas = [
  ['dueno', '/app/admin/tablero', 'dueno-1-tablero'],
  ['dueno', '/app/admin/pedidos', 'dueno-2-pedidos-vivo'],
  ['dueno', '/app/admin/carta', 'dueno-3-carta'],
  ['dueno', '/app/admin/estaciones', 'dueno-4-cocinas'],
  ['dueno', '/app/admin/inicio', 'dueno-5-pagina-inicio'],
  ['dueno', '/app/admin/promociones', 'dueno-6-promociones'],
  ['dueno', '/app/admin/usuarios', 'dueno-7-equipo'],
  ['dueno', '/app/admin/reportes', 'dueno-8-reportes'],
  ['dueno', '/app/admin/monitoreo/cocina', 'dueno-9-monitoreo'],
  ['cajero', '/app/caja', 'cajero-1-caja'],
  ['cocina', '/app/cocina', 'cocina-1-selector'],
  ['cocina', '/app/cocina/rapida', 'cocina-2-tablero'],
  ['pase', '/app/pase', 'pase-1'],
  ['mesero', '/app/mesero', 'mesero-1'],
  ['domi', '/app/domicilios', 'domi-1'],
]

let sesionActual = null
let ctx = null
let page = null

for (const [rol, ruta, nombre] of pantallas) {
  if (sesionActual !== rol) {
    if (ctx) await ctx.close()
    ctx = await navegador.newContext({ deviceScaleFactor: 1 })
    page = await ctx.newPage()
    await entrar(page, CUENTAS[rol])
    sesionActual = rol
  }
  const movil = rol === 'domi' || rol === 'mesero'
  await foto(page, ruta, nombre, { movil })
}

if (ctx) await ctx.close()
await navegador.close()
console.log('\nCapturas en', SALIDA)
