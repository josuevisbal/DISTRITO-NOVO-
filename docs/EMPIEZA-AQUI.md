# Distrito Novo — Empieza aquí

Tu lista de pasos. Nada de teoría: solo lo que tienes que hacer, en orden.
Lo que ya está hecho no lo repito.

---

## Ya está listo (no toques nada de esto)
- La base de datos del cliente en Supabase: montada, cargada con los 84 productos y segura.
- La base de pruebas (en tu cuenta): lista para desarrollar sin miedo.
- Todos los archivos del proyecto: te los dejé listos para descargar.

---

## Lo que tienes que hacer

### Paso 1 — Instala tres cosas (una sola vez)
1. **Node.js** — de nodejs.org, la versión "LTS". Es lo que hace funcionar la app.
2. **Claude Code** — la herramienta que va a escribir la aplicación por ti.
3. **Cuenta en GitHub** y **cuenta en Vercel** — gratis las dos. Con GitHub puedes entrar a Vercel.

### Paso 2 — Arma la carpeta del proyecto
1. Crea una carpeta vacía en tu computador, llámala `distrito-novo`.
2. Mete adentro estos archivos que te descargaste:
   - `CLAUDE.md`
   - `PROMPT-CLAUDE-CODE.md`
   - Crea una subcarpeta llamada `supabase` y adentro pon `schema.sql` y `seed-distrito-novo.sql`.
   - `env.local.txt` — renómbralo a `.env.local` (con el punto adelante, y sin el `.txt`).

### Paso 3 — Completa las llaves secretas
Abre `.env.local` con el bloc de notas. Ve al Supabase (primero al de PRUEBAS) →
Project Settings → API Keys → copia la **service_role** y pégala donde dice
`PEGA_AQUI_LA_SERVICE_ROLE_DE_PRUEBAS`. Guarda.

### Paso 4 — Arranca Claude Code
1. Abre Claude Code dentro de la carpeta `distrito-novo`.
2. Copia TODO el contenido de `PROMPT-CLAUDE-CODE.md` y pégalo como primer mensaje.
3. Claude Code va a trabajar por fases. Al final de cada fase te pide permiso para seguir.
   Revisa que funcione y dile "sigue". **No lo apures a hacer todo de una vez.**
4. En la Fase 1, dile que **NO corra las migraciones** (schema y seed), porque la base ya
   está montada. Que solo se conecte y genere los tipos.

### Paso 5 — Cuando la app funcione en tu computador
Claude Code te ayuda a subirla a GitHub. Solo dile: "súbelo a un repositorio de GitHub".

### Paso 6 — Publícala en internet (Vercel)
1. Entra a vercel.com, conecta tu GitHub, elige el repositorio.
2. En "Environment Variables" pega las llaves — **aquí van las de PRODUCCIÓN (el cliente)**,
   no las de pruebas.
3. Deploy. Te queda una dirección web pública.

### Paso 7 — Avísame
Cuando llegues al paso 5 o 6, escríbeme. Te acompaño a dejar bien separadas las llaves de
pruebas y las de producción en Vercel, que es donde más gente se equivoca.

---

## Dos reglas que te ahorran problemas
- **Desarrolla con las llaves de PRUEBAS.** Solo usa las de producción (el cliente) cuando
  la app ya funcione bien. Así nunca dañas los datos reales.
- **La service_role es secreta.** Nunca la pegas en una página web, nunca la subes a GitHub.
  Solo va en `.env.local` (que no se sube) y en las variables de Vercel.

---

## Lo único que depende de otra persona
Nada por ahora. Todo lo de esta lista lo haces tú con Claude Code al lado.
Cuando quieras, ese mismo Claude Code te va resolviendo las dudas técnicas de cada paso.
