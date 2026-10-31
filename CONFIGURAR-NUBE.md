# Activar el modo en línea (Firebase) — guía paso a paso

Con esto los dos kinesiólogos comparten los mismos datos, fotos e íconos desde dispositivos distintos, y el
cuerpo técnico entra con un link de invitación que vence cada 30 días. Todo es gratuito para este tamaño de uso
(plan Spark de Firebase). Toma unos 15 minutos y se hace una sola vez.

## 1. Crear el proyecto
1. Entra a https://console.firebase.google.com con una cuenta Google (conviene una del área, no personal).
2. **Crear un proyecto** → nombre, por ejemplo, `kine-sw` → puedes desactivar Google Analytics → Crear.

## 2. Activar el inicio de sesión
1. Menú **Compilación → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → activa **Correo electrónico/contraseña** y también **Anónimo** (el cuerpo técnico entra con el link usando este método).
3. Pestaña **Users → Agregar usuario**: crea la **cuenta de administradores** (un correo y una contraseña fuerte; la usan ambos kinesiólogos).
4. Recomendado: en **Configuración → Acciones del usuario** desactiva "Habilitar la creación (registro)" para que nadie más pueda crear cuentas.

## 3. Crear la base de datos
1. **Compilación → Firestore Database → Crear base de datos** → ubicación `southamerica-west1` (Santiago, la más cercana) → modo **producción**.
2. Pestaña **Reglas**: borra lo que hay y pega el contenido del archivo `firestore.rules`.
   Ese archivo **no se sube a GitHub** (contiene el correo de administrador): se entrega aparte y se pega solo aquí, en la consola de Firebase.
   Si usas una plantilla, cambia `CORREO_ADMIN@gmail.com` por el correo exacto de la cuenta de administradores. Pulsa **Publicar**.
   (Estas reglas son lo que impide que el cuerpo técnico edite algo y que vea los datos del seguro.)
   **Cada vez que se entregue una versión nueva de `firestore.rules`, hay que volver a pegarla y publicarla.** En la app, **Ajustes → Chequeo de salud** avisa si las reglas no permiten guardar los datos del seguro.

## 4. Conectar la app
1. **Configuración del proyecto (engranaje) → General → Tus apps → ícono web `</>`** → registra la app (cualquier nombre) → copia el bloque `firebaseConfig`.
2. Abre `js/firebase-config.js` y pega `apiKey`, `authDomain`, `projectId` y `appId`.
3. En **Authentication → Settings → Dominios autorizados** agrega el dominio de GitHub Pages: `TU-USUARIO.github.io`.
4. Sube la carpeta a GitHub (como en el LEEME). Abre la dirección en Chrome e inicia sesión con la cuenta de administradores.
   La primera vez que entre un administrador, la nube se llena con los datos de partida (calendario y cuerpo técnico).

## 5. Link del cuerpo técnico
En la app: **Ajustes → Acceso del cuerpo técnico**. Ahí está el link vigente; **Copiar** o **Compartir (WhatsApp)**.
- Vence a los 30 días. Después hay que generar uno nuevo (la app avisa cuando faltan 5 días o menos).
- **Generar link nuevo** invalida el anterior: quienes lo usaban pierden el acceso en cuanto vuelven a conectarse (si el dispositivo estaba sin internet, puede seguir viendo lo que ya tenía guardado hasta entonces).
- Quien abre el link queda con la sesión iniciada en ese dispositivo hasta que el link venza o se renueve.

## Cosas que conviene saber
- **Sin internet:** se puede seguir registrando; los cambios se suben solos al volver la conexión (el indicador de arriba dice "Sin conexión" o "Guardando…"). Iniciar sesión por primera vez sí requiere internet.
- **Dos personas a la vez:** cada informe se guarda por partes (cada jugador, lesión o atención es independiente), así que quien edita la Sub 15-16 y quien edita la Sub 18-20 no se pisan. Si ambos editan exactamente el mismo registro a la vez, queda el último guardado.
- **Qué ve el cuerpo técnico:** la aplicación solo les muestra el informe por categoría. Las reglas de Firestore les permiten *leer* los datos del informe (incluidas las notas clínicas, necesarias para armarlo), pero no escribir nada, y **no pueden leer los datos del seguro** (RUT, diagnóstico), que quedan en una zona privada solo para administradores.
- **Datos de menores:** usa una contraseña fuerte y activa la verificación en dos pasos en el correo de la cuenta de administradores, no reenvíes el link fuera del cuerpo técnico, y genera uno nuevo si cambia el personal. "Cerrar sesión" borra los datos guardados en ese dispositivo (siguen en la nube); si estabas sin internet con cambios pendientes, conéctate antes de cerrar sesión.
- **Muy recomendado:** en Google Cloud (Credenciales) restringe la clave de API a tu dominio `TU-USUARIO.github.io`.
- **Copias de seguridad:** en **Ajustes → Datos y respaldo** se puede descargar un respaldo (`.json`) cuando quieras.
- **Costos:** el plan gratuito cubre con holgura este uso. No hace falta tarjeta porque la app guarda las fotos dentro de Firestore (no usa Firebase Storage).
