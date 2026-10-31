# Informe Kinésico SW — Kinesiología Fútbol Joven

App instalable (funciona sin conexión) para registrar atenciones, lesiones y controles del fútbol joven
de Santiago Wanderers, y generar el informe (anual, semestral, trimestral o por fechas) en PDF tamaño carta.

## Subirla a GitHub e instalarla desde Chrome

1. En GitHub crea un repositorio nuevo (por ejemplo `informe-kine-sw`).
2. Sube **todo el contenido de esta carpeta** (que `index.html` quede en la raíz del repositorio, junto a `sw.js`,
   `manifest.webmanifest` y los íconos `icon-*.png`).
3. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. Espera un minuto y abre la dirección que te muestra GitHub (`https://TU-USUARIO.github.io/informe-kine-sw/`) en **Chrome**.
5. Menú ⋮ → **Instalar aplicación** (o “Agregar a la pantalla de inicio”).

## Modo en línea (recomendado)

Para compartir datos, fotos e íconos entre los dos kinesiólogos y dar acceso al cuerpo técnico con un link,
sigue **CONFIGURAR-NUBE.md** (Firebase, gratis). Si no completas `js/firebase-config.js`, la app funciona solo
en el dispositivo, como antes.

## Privacidad (importante: son datos de menores)

- En GitHub solo va el **código** de la app: nunca los jugadores, lesiones ni fotos. No subas a GitHub el archivo `firestore.rules` ni respaldos.
- **Sin nube configurada:** los datos se guardan únicamente en el dispositivo donde se usa la app (cada kinesiólogo tiene los suyos).
- **Con la nube (Firebase, ver CONFIGURAR-NUBE.md):** los datos se guardan en tu proyecto de Firebase (Santiago), visibles solo para quienes tengan la cuenta de administrador o el link del cuerpo técnico.
- Haz respaldos en **Ajustes → Datos y respaldo** (descarga un archivo `.json`). Si cambias de equipo o borras los datos
  del navegador, se recuperan con **Importar**.
- No subas a GitHub los archivos de respaldo.

## Actualizar la app

Reemplaza los archivos en GitHub y sube el número de `VERSION` en `sw.js` (por ejemplo `1.0.1`) para que los
dispositivos descarguen la versión nueva. Tus datos no se pierden al actualizar.

## Qué incluye la v.1

- Portada, calendario de partidos y cuerpo técnico editables (varias personas por cargo, con marca de “apoyo”).
- Resumen final en dos páginas, con indicadores que se pueden agregar, ocultar y reordenar.
- Ficha individual por jugador con mapa corporal (verde leve · amarillo moderada · rojo grave), minutos
  calculados desde el calendario, controles y exámenes, intervenciones y campos adicionales.
- Registro de atenciones (incluso a varios jugadores a la vez), lesiones/molestias, controles, exámenes,
  medicamentos y cirugías.
- Totales automáticos por período y ajustes manuales cuando haga falta.
- Descargar PDF: botón “Descargar PDF” → en la ventana de impresión elegir **Guardar como PDF**, tamaño **Carta**.
