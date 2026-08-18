# Eco — Asistente musical accesible

PWA para músicos con discapacidad visual: afinador, lector de partituras, metrónomo, detector de pedales y ajustes de accesibilidad — todo navegable por voz y teclado.

## Pantallas

| Pantalla       | Ruta                   | Estado          |
| -------------- | ---------------------- | --------------- |
| Afinador       | `/afinador`            | ✅ Completo     |
| Leer partitura | `/partitura`           | 🚧 Funcional, precisión irregular |
| Metrónomo      | `/metronomo`           | ✅ Completo     |
| Detectar pedal | `/pedal`               | 🚧 Funcional, precisión parcial |
| Ajustes        | `/ajustes`             | ✅ Completo     |
| Información    | `/informacion`         | ✅ Completo     |

Las dos pantallas marcadas con 🚧 están implementadas de punta a punta, pero el reconocimiento por visión que las alimenta todavía se equivoca. La de pedal **declara explícitamente cuándo no pudo leer una perilla** en vez de arriesgar un número; la de partitura todavía narra un acorde mal reconocido con la misma seguridad que uno correcto. Ver `INFORME.md` §2.3 y `claude-docs/PEDAL.md`.

> La detección de perillas migró el 2026-08-18 de un detector OpenCV local a un modelo multimodal (Gemini). Su precisión sobre el pedal físico **todavía no está medida**; ver `claude-docs/PEDAL.md`.

## Stack

| Rol             | Tecnología                             |
| --------------- | -------------------------------------- |
| Framework       | Next.js 15 App Router + TypeScript     |
| Estilos         | Tailwind CSS v4                        |
| Accesibilidad   | react-aria-components (Adobe)          |
| PWA             | @serwist/next                          |
| Pitch detection | pitchfinder (algoritmo YIN, Web Audio) |
| TTS             | Web Speech API nativo                  |
| OCR de cifrado  | Tesseract vía child_process            |
| Visión de perillas | Gemini (`@google/genai`), server-side |
| Estado global   | React Context                          |
| Persistencia    | localStorage                           |

## Instalación y desarrollo

```bash
npm install
npm run dev           # http://localhost:3000
npm run build         # build de producción
npm run lint          # ESLint + jsx-a11y
npm run format        # Prettier (sobreescribe)
npm run format:check  # Prettier (solo verifica)
```

## Deployment

```bash
# Construir y levantar con Docker Compose
docker compose up --build
```

La app queda disponible en el puerto 3000.

En producción se hostea en **Vercel**, que construye el proyecto Next.js de forma nativa. Los comandos Docker de arriba sirven para desarrollo y autohospedaje, pero **Vercel no usa el `Dockerfile`**: las dependencias de sistema que ese archivo instala no existen en producción. Ver `DECISIONS.md` para las consecuencias.

En Vercel hay que cargar `GEMINI_API_KEY` en Settings → Environment Variables (Production y Preview). La variable se aplica en el deploy siguiente a su creación: si se agrega después de pushear, hay que redeployar.

Los esquemas anteriores —Railway construyendo el `Dockerfile`, y Docker sobre un servidor local expuesto con Cloudflare Tunnel— siguen siendo válidos como alternativas autohospedadas.

Copiar `.env.local.example` a `.env.local` y completar:

| Variable | Requerida | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | sí | URL pública (manifest de la PWA y metadatos). |
| `GEMINI_API_KEY` | solo para `/pedal` | Detección de perillas. Se obtiene gratis en [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Es una clave de servidor: **nunca** prefijarla con `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | no | Modelo multimodal. Default `gemini-2.5-flash`. |

Sin `GEMINI_API_KEY` la app arranca y funciona normalmente; solo `/pedal` responde con un mensaje narrado explicando que el servicio no está disponible.

El `Dockerfile` instala las dependencias de sistema que necesita el OCR de partitura: `tesseract-ocr` y `poppler-utils`.

## Privacidad y procesamiento de datos

Casi todo se procesa **en el dispositivo**, sin salir a internet: el afinador (Web Audio + pitchfinder), el metrónomo, el narrador (Web Speech API) y las preferencias (`localStorage`). La app es instalable como PWA y esas funciones andan sin conexión.

Hay dos excepciones, ambas en el servidor de la propia app:

- **`/partitura`** manda la foto o el PDF al servidor, donde Tesseract lo procesa localmente. La imagen no sale de la infraestructura de la app.
- **`/pedal`** manda las fotos del pedal a la **API de Gemini, de Google**. Las imágenes salen del dispositivo y de la infraestructura de la app hacia un tercero, y en el tier gratuito de Gemini Google puede usar los datos enviados para mejorar sus modelos. Sin conexión a internet, esta pantalla no funciona.

Esa excepción es deliberada: el detector local anterior no alcanzaba una precisión usable (ver `DECISIONS.md`, 2026-08-18). Las funciones críticas en vivo —afinador y metrónomo— siguen siendo 100 % locales.

## Accesibilidad

La app apunta a cumplir **WCAG 2.2 nivel AA**.

Targets de validación:

- Lighthouse Accessibility ≥ 95
- axe DevTools: cero violaciones críticas o serias
- WAVE: cero errores

Validación manual requerida:

- Navegación solo teclado (Tab completo en toda la app)
- VoiceOver en iOS Safari (pantallas Afinador y Ajustes)
- NVDA en Windows + Chrome (pantalla Partitura)
- Con CSS deshabilitado — todas las pantallas (SSR)
- Con JS deshabilitado — todas las pantallas (SSR)
- Viewports 375 px, 390 px (móvil) y 1280 px (desktop)
