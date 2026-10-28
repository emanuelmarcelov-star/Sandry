# Fase 1 — Preparación: pasos para ti

Ya está hecho: Node y git instalados, el proyecto creado, la app instalable (PWA),
el aviso de "sin conexión", 33 pruebas automáticas pasando y 4 commits en git.

Falta lo que solo tú puedes hacer: crear las cuentas y publicar la app.
Tiempo estimado: 20–30 minutos.

---

## Paso A — Ver la app en tu computadora

1. Abre una terminal (PowerShell) y escribe:
   ```
   cd C:\Users\Emanuel\Desktop\tienda-web
   npm run dev
   ```
2. Abre en el navegador: http://localhost:3000
3. Debes ver "Bienvenida a Sandry" y "Conexión con la base de datos: Falta configurar".
   Es normal: todavía no creamos la base de datos.
4. Para detenerla: en la terminal presiona `Ctrl + C`.

## Paso B — GitHub (donde se guarda el código)

1. Entra a https://github.com/signup y crea una cuenta (si no tienes).
2. Arriba a la derecha: **+** → **New repository**.
3. Nombre: `sandry`. Marca **Private**. **No** marques "Add a README" ni nada más.
4. Clic en **Create repository**.
5. Copia la dirección que aparece (algo como `https://github.com/TU-USUARIO/sandry.git`)
   y pásamela. Yo subo el código; la primera vez se abrirá una ventana para que
   inicies sesión en GitHub.

## Paso C — Supabase (la base de datos)

1. Entra a https://supabase.com y elige **Start your project** → **Continue with GitHub**.
2. **New project**:
   - Name: `sandry`
   - Database Password: clic en **Generate a password** y **guárdala en un lugar seguro**
     (un cuaderno o un gestor de contraseñas). **No me la pases.**
   - Region: **East US (North Virginia)** (es la más cercana a Ecuador).
   - Plan: **Free**.
3. Espera 1–2 minutos a que se cree.
4. Clic en el botón **Connect** (arriba) o ve a **Project Settings → API Keys**, y copia:
   - **Project URL** (empieza con `https://` y termina en `.supabase.co`)
   - **Publishable key** (empieza con `sb_publishable_`)
5. Pásame esos dos valores. Son públicos por diseño (lo que protege los datos son
   las reglas de la base de datos), así que puedes pegarlos aquí sin problema.
   ⚠️ La **secret key** y la contraseña de la base de datos NO me las pegues en el chat.

## Paso D — Netlify (publicar la app en internet)

Hazlo después de que yo haya subido el código a GitHub.

1. Entra a https://app.netlify.com/signup y elige **Sign up with GitHub**.
2. **Add new project** → **Import an existing project** → **GitHub**.
3. Autoriza a Netlify y elige el repositorio `sandry`.
4. En la pantalla de configuración, deja todo como viene (ya lo configuré en
   `netlify.toml`). Busca **Environment variables** → **Add environment variables** y
   agrega estas dos (con los valores del Paso C):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Clic en **Deploy**. En 2–4 minutos te da un enlace como
   `https://algo-raro-123.netlify.app`.
6. (Opcional) **Project configuration → Change project name** → `sandry-tienda` para que
   el enlace sea `https://sandry-tienda.netlify.app` (si está libre).

## Paso E — Probar en el celular

1. Abre el enlace de Netlify en el celular.
2. Debe decir "Conexión con la base de datos: ✓ Conectada".
3. Instálala:
   - **Android (Chrome)**: menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**.
   - **iPhone (Safari)**: botón **Compartir** → **Agregar a inicio**.
4. Abre la app desde el ícono verde "S".
5. Pon el celular en **modo avión**: aparece una franja amarilla que dice
   "Sin conexión a internet…". Quita el modo avión: la franja desaparece sola.

Cuando todo esto funcione, dime **"fase 1 aprobada"** y empezamos la fase 2 (usuarios).

---

## Sobre los correos (para la fase 2)

Para "Olvidé mi contraseña" necesitamos enviar correos. El correo de Supabase gratis
casi no sirve: envía muy pocos y solo a los miembros de tu equipo de Supabase.
Y Resend gratis, sin un dominio propio, solo envía a tu propio correo. En la fase 2
te propondré la opción más simple y gratuita. Por ahora **no hace falta crear
cuenta en Resend**.
