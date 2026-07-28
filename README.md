# Eco — Asistente musical accesible

PWA para músicos con discapacidad visual: afinador, lector de partituras, metrónomo, detector de pedales y ajustes de accesibilidad — todo navegable por voz y teclado.

## Pantallas

| Pantalla       | Ruta                   | Estado          |
| -------------- | ---------------------- | --------------- |
| Afinador       | `/afinador`            | ✅ Completo     |
| Leer partitura | `/partitura`           | 🚧 Funcional, precisión irregular |
| Metrónomo      | `/partitura/metronomo` | ✅ Completo     |
| Detectar pedal | `/pedal`               | 🚧 Funcional, precisión parcial |
| Ajustes        | `/ajustes`             | ✅ Completo     |

Las dos pantallas marcadas con 🚧 están implementadas de punta a punta, pero el reconocimiento por visión que las alimenta todavía se equivoca. La de pedal vota entre 5 capturas y **declara explícitamente cuándo no pudo leer una perilla** en vez de arriesgar un número; la de partitura todavía narra un acorde mal reconocido con la misma seguridad que uno correcto. Ver `INFORME.md` §2.3 y `claude-docs/PEDAL.md`.

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

En producción se hostea en **Railway**, que construye y ejecuta el `Dockerfile` del repo directamente, sin configuración adicional: provee HTTPS y dominio público sin mantener un servidor propio. El esquema anterior —Docker sobre un servidor local expuesto con Cloudflare Tunnel— sigue siendo válido como alternativa autohospedada. Ver `DECISIONS.md`.

Copiar `.env.local.example` a `.env.local` y reemplazar `NEXT_PUBLIC_APP_URL` con la URL pública en producción.

El `Dockerfile` instala las dependencias de sistema que necesitan las rutas de API: `tesseract-ocr` y `poppler-utils` para el OCR de partitura, `opencv-python-headless` y `numpy` para la detección de perillas.

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
