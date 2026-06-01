# Eco — Asistente musical accesible

PWA para músicos con discapacidad visual: afinador, lector de partituras, metrónomo, detector de pedales y ajustes de accesibilidad — todo navegable por voz y teclado.

## Pantallas

La infraestructura base (rutas, layout, navegación, PWA, Docker) está completa. Las pantallas tienen estructura de placeholder; la lógica de features está pendiente.

| Pantalla       | Ruta                   | Estado       |
| -------------- | ---------------------- | ------------ |
| Afinador       | `/afinador`            | ⬜ Pendiente |
| Leer partitura | `/partitura`           | ⬜ Pendiente |
| Metrónomo      | `/partitura/metronomo` | ⬜ Pendiente |
| Detectar pedal | `/pedal`               | ⬜ Pendiente |
| Ajustes        | `/ajustes`             | ⬜ Pendiente |

## Stack

| Rol             | Tecnología                             |
| --------------- | -------------------------------------- |
| Framework       | Next.js 15 App Router + TypeScript     |
| Estilos         | Tailwind CSS v4                        |
| Accesibilidad   | react-aria-components (Adobe)          |
| PWA             | @serwist/next                          |
| Pitch detection | pitchfinder (algoritmo YIN, Web Audio) |
| TTS             | Web Speech API nativo                  |
| OCR/OMR         | oemer (Python) vía child_process       |
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

La app queda disponible en el puerto 3000. Cloudflare Tunnel se configura apuntando a `localhost:3000` para exponer la app vía HTTPS con dominio público.

Copiar `.env.local.example` a `.env.local` y reemplazar `NEXT_PUBLIC_APP_URL` con la URL del tunnel en producción.

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
