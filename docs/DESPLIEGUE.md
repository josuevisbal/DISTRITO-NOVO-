# Despliegue en Vercel

El sistema corre en Vercel con su base en Supabase. **Un despliegue por restaurante**, cada
uno con sus propias variables apuntando a su Supabase. El código es el mismo para todos.

## Lo que necesitas

- La URL y la llave **anon/publicable** del proyecto de Supabase (Settings → API).
  Son las dos únicas variables obligatorias.
- Una cuenta de GitHub y una de Vercel (gratis).

## Paso a paso

### 1. Sube el código a GitHub

Desde la carpeta del proyecto:

```bash
git remote add origin https://github.com/TU_USUARIO/distrito-novo.git
git push -u origin master
```

> `.env.local` no se sube (está en `.gitignore`). Las llaves se ponen en Vercel, no en el repo.

### 2. Crea el proyecto en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio de GitHub.
2. Framework: **Next.js** (lo detecta solo). No cambies el build ni el output.
3. En **Environment Variables**, agrega:

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la llave publicable de Supabase |

4. **Deploy**. En un par de minutos queda una URL pública.

### 3. Apunta Supabase a esa URL

En Supabase → Authentication → URL Configuration, agrega la URL de Vercel a
**Site URL** y a **Redirect URLs**, para que el login del equipo funcione.

## Actualizaciones

Cada `git push` a `master` vuelve a desplegar solo. Un arreglo se hace una vez y llega a
todos los despliegues.

## Dar de alta OTRO restaurante (misma plantilla)

1. Crear su proyecto en Supabase y correr `supabase/schema.sql` + su propio `seed`.
2. Agregar su marca en `src/config/tema.ts` (una entrada por `slug`).
3. Nuevo proyecto en Vercel apuntando al mismo repo, con **sus** variables.

Sin tocar ningún componente.

## Pendientes que sí requieren la llave `service_role`

Hoy la app **no** la necesita. Solo hará falta para:

- **Alta de logins desde el panel de admin** (crear usuarios del equipo). Mientras tanto se
  crean desde la consola de Supabase.
- **Webhook de una pasarela** de pago en línea.

Cuando se agreguen, se pone `SUPABASE_SERVICE_ROLE_KEY` como variable de entorno en Vercel
(marcada como secreta) — nunca con el prefijo `NEXT_PUBLIC_`.
