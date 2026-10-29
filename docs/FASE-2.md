# Fase 2 — Usuarios: qué hay y cómo probarlo

Enlace de la app: **https://storied-raindrop-2de6ba.netlify.app**

## Qué se hizo

- **Registro** con nombre, correo, teléfono, cédula (opcional, se revisa que sea válida),
  contraseña de 8 o más caracteres y foto opcional.
- **La primera persona que se registra queda como administradora.** Las demás esperan
  aprobación.
- **Entrar** con correo y contraseña, con la casilla «Recordarme en este dispositivo».
- **Olvidé mi contraseña** (llega un enlace por correo) y **Olvidé mi correo** (con el
  teléfono o la cédula muestra el correo a medias, por ejemplo `ma****@gmail.com`;
  máximo 5 intentos por hora).
- **Roles**: Administradora, Trabajadora/Cajera y Encargada de inventario, con
  **casillas de permisos** que la administradora puede cambiar.
- **Usuarios**: aprobar, cambiar rol, desactivar/reactivar (sin borrar historial),
  borrar el PIN de alguien, corregir su correo e **invitar por correo**.
- **PIN** de 4 a 6 números para **cambiar de usuario rápido** en un dispositivo
  compartido (solo personas que ya entraron con contraseña en ese dispositivo). Tras 5
  errores se bloquea 15 minutos.
- **Cierre de sesión por inactividad** (30 minutos por defecto; se cambia en Ajustes).
- **Bitácora**: quién aprobó, cambió roles o permisos, entró con PIN, etc.
- **Modo claro y oscuro** (desde el menú).
- Seguridad: los permisos se revisan en el servidor **y** dentro de la base de datos.
  Nadie puede leer los PIN, ni siquiera la administradora.

Pruebas automáticas: 43 de lógica, 29 de reglas de la base de datos y 18 de flujos
completos en el navegador. Todas pasan.

---

## Pasos para ti

### Paso 1 — Que tu mamá se registre primero (¡hoy!)

La primera persona que se registra en la app de la tienda queda como administradora.
Por eso conviene que **tu mamá se registre cuanto antes**:

1. Abre https://storied-raindrop-2de6ba.netlify.app/registro
2. Llena sus datos y toca **Crear cuenta**.
3. Debe aparecer «Hola, (su nombre)». En el menú (arriba a la derecha) verá
   «Administradora».

Si prefieres ser tú el administrador, regístrate tú primero y después le das a ella el
rol de Administradora desde **Usuarios** (pueden ser varias administradoras).

### Paso 2 — Poner la clave secreta en Netlify (5 minutos)

Sin esta clave **no funcionan**: cambiar de usuario con PIN, invitar por correo,
«Olvidé mi correo» y revisar cédulas repetidas. Es secreta: **no la pegues en el chat**.

1. Entra a https://supabase.com/dashboard y abre el proyecto **de la tienda**
   (el que NO se llama «Sandry-pruebas»).
2. ⚙️ **Project Settings** → **API Keys**.
3. En **Secret keys**, toca el ícono del ojo 👁 para verla y luego **copiar** 📋.
4. Entra a https://app.netlify.com → tu proyecto → **Project configuration** →
   **Environment variables** → **Add a variable** → **Add a single variable**.
5. En **Key** escribe exactamente: `SUPABASE_SECRET_KEY`
6. En **Values** pega la clave.
7. Marca la casilla **Contains secret values** (contiene valores secretos).
8. Toca **Create variable**.
9. Ve a **Deploys** → **Trigger deploy** → **Deploy project** y espera 2–3 minutos.

### Paso 3 — Gmail para los correos (15 minutos)

Para que lleguen los correos de «Olvidé mi contraseña» y las invitaciones:

1. Crea un Gmail solo para la tienda en https://accounts.google.com/signup
   (por ejemplo `tiendasandry@gmail.com`).
2. Con ese Gmail, activa la **Verificación en 2 pasos**:
   https://myaccount.google.com/signinoptions/twosv
3. Crea una **contraseña de aplicación**: https://myaccount.google.com/apppasswords
   - Nombre: `Sandry`
   - Google te muestra 16 letras (por ejemplo `abcd efgh ijkl mnop`). **Cópialas.**
     No me las pases.
4. En Supabase, proyecto **de la tienda**: **Authentication** → **Emails** →
   **SMTP Settings** → activa **Enable custom SMTP** y llena:
   - **Sender email**: el Gmail de la tienda
   - **Sender name**: `Sandry`
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Username**: el Gmail de la tienda
   - **Password**: las 16 letras de la contraseña de aplicación (sin espacios)
5. Toca **Save**.
6. Avísame: yo activo los correos en español (ya están listos).

---

## Cómo probarlo tú mismo

Usa dos navegadores o un celular y una computadora.

1. **Registro de una trabajadora**: en otro dispositivo, regístrate con otro correo.
   Debe decir «Tu cuenta espera aprobación».
2. **Aprobar**: con la cuenta de la administradora, en Inicio aparece «Hay 1 persona
   esperando tu aprobación» → **Revisar** → elige **Trabajadora / Cajera** → **Aprobar**.
3. **Permisos**: entra como la trabajadora. En el menú NO deben aparecer Usuarios,
   Bitácora ni Ajustes.
4. **PIN**: como la trabajadora, ve a **Mi cuenta** → crea un PIN (por ejemplo 2468).
   Luego en el mismo dispositivo entra como administradora. Abre el menú →
   **Cambiar de usuario** → toca el nombre de la trabajadora → escribe el PIN → Entrar.
5. **Roles y permisos**: como administradora, menú → **Roles y permisos** → marca una
   casilla para la cajera → **Guardar**. Verás el cambio en la **Bitácora**.
6. **Olvidé mi correo**: cierra sesión → «Olvidé mi correo» → escribe el teléfono de la
   trabajadora.
7. **Inactividad**: en **Ajustes** pon 1 minuto, espera 1–2 minutos sin tocar nada y la
   sesión se cierra sola. Luego vuelve a ponerlo en 30.
8. **Desactivar**: en **Usuarios**, desactiva a la trabajadora. Ya no podrá entrar.
   Reactívala con **Reactivar**.

Cuando todo te funcione, dime **«fase 2 aprobada»** y seguimos con la fase 3 (catálogo).
