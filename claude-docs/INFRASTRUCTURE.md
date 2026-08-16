# Infraestructura — eco-app

> Documentación de la infraestructura base inicializada el **2026-06-01**.
> Describe **qué existe y cómo está cableado**. El **porqué** de cada elección de stack vive en [`DECISIONS.md`](../DECISIONS.md). La fuente de verdad funcional es [`SPECIFICATION.md`](../SPECIFICATION.md).

En esta etapa **no hay lógica de features**: las pantallas y sus componentes son placeholders. Lo que sigue es la base sobre la que se montan.

---

## Versiones del stack

| Paquete | Versión | Nota |
| --- | --- | --- |
| `next` | 15.5.19 | Pineado a 15 a propósito (ver DECISIONS.md). No 16. |
| `react` / `react-dom` | 19.2.4 | |
| `typescript` | ^5 | `strict: true` |
| `tailwindcss` | ^4 | Config CSS-first (`@import "tailwindcss"`) |
| `@serwist/next` / `serwist` | 9.5.11 | PWA / service worker |
| `react-aria-components` | 1.18.0 | Componentes accesibles (no `react-aria`) |
| `pitchfinder` | 2.3.4 | Detección de pitch (YIN); trae tipos propios |
| `eslint` | ^9 | Flat config vía `FlatCompat` |
| `prettier` | 3.8.3 | + `prettier-plugin-tailwindcss` 0.8.0 |

---

## Estructura de archivos

Coincide con `SPECIFICATION.md §3`. Estado de cada pieza:

```
app/
├── layout.tsx          # REAL: skip link, nav, script anti-flash, SettingsProvider, <main>
├── page.tsx            # REAL: redirect a /afinador
├── globals.css         # REAL: tokens de diseño, tema, escala de fuente
├── manifest.ts         # REAL: manifest PWA (§7)
├── sw.ts               # REAL: service worker de Serwist
├── afinador/page.tsx          # placeholder (PageHeader + title)
├── partitura/page.tsx         # placeholder
├── metronomo/page.tsx         # placeholder
├── pedal/page.tsx             # placeholder
├── ajustes/page.tsx           # placeholder
└── api/ocr/route.ts           # placeholder: POST → 501
components/
├── layout/  SkipLink, Navigation, PageHeader    # REAL
├── tuner/   TunerDisplay, PitchIndicator, TunerEngine   # placeholder
├── score/   ScoreUpload, ScorePreview, HarmonyList      # placeholder
├── metronome/ Metronome                          # placeholder
├── pedal/   CameraView, PedalInfo                # placeholder
└── settings/ SettingCarousel                     # placeholder
contexts/ SettingsContext.tsx   # REAL
lib/      settings.ts (REAL) · pitch.ts, tts.ts, metronome.ts (stubs)
hooks/    useMicrophone.ts, useCamera.ts (stubs)
public/icons/.gitkeep           # íconos PWA todavía no generados
```

---

## Infraestructura cableada (lógica real)

### Estado global — `contexts/SettingsContext.tsx` + `lib/settings.ts`

- `EcoSettings` (`theme`, `fontSize`, `ttsSpeed`) y `DEFAULT_SETTINGS` (light / md / normal) viven en `lib/settings.ts`.
- Persistencia en `localStorage` bajo la key `eco-settings`. `loadSettings()` hace merge con defaults y es seguro en SSR.
- `TTS_SPEED_RATES` mapea la velocidad del narrador a `SpeechSynthesis.rate` (slow 0.75 · normal 1 · fast 1.25 · very-fast 1.5).
- `SettingsContext` aplica `data-theme` y `data-font-size` sobre `document.documentElement` ante cada cambio y persiste. Hook de consumo: `useSettings()` (tira error si se usa fuera del provider).

### Tema y accesibilidad — `app/layout.tsx` + `app/globals.css`

- **Script anti-flash**: script inline síncrono en el `<head>` que lee `localStorage['eco-settings']` y aplica `data-theme`/`data-font-size` antes del primer paint (evita flash de tema/tamaño). Degrada a defaults si no hay JS o el JSON es inválido.
- **Tokens de diseño** en `globals.css`: variables CSS de `SPECIFICATION.md §4` para `:root` y `[data-theme="high-contrast"]` (`dark` queda como placeholder v2).
- **Escala de fuente** vía `html[data-font-size="..."]` con base en `rem` (sm 14 · md 16 · lg 18 · xl 20 px).
- **Foco visible** global con `:focus-visible`; nunca `outline: none`.
- Orden accesible del layout: `lang="es"` → script anti-flash → `SkipLink` (primer focusable) → `Navigation` → `<main id="main-content" tabindex="-1">`.

### Navegación — `components/layout/Navigation.tsx`

- 4 ítems (Partitura, Pedal, Afinador, Ajustes) en `<nav aria-label="Navegación principal">`.
- Ítem activo con `aria-current="page"` + subrayado azul (el estado no depende solo del color).
- Responsive: bottom tab bar (móvil, <768px) / sidebar izquierda (desktop, ≥768px) con breakpoint `md:`.

### PWA — `app/manifest.ts` + `app/sw.ts`

- Manifest según `SPECIFICATION.md §7` (`start_url: /afinador`, íconos 192/512 — aún por generar).
- Serwist con `defaultCache`, `skipWaiting`, `clientsClaim`, `navigationPreload`. **Deshabilitado en development** (`disable: NODE_ENV === 'development'`) para no generar el SW al hacer `dev`.

---

## Configuración de tooling

### TypeScript — `tsconfig.json`

- `strict: true`. Sin `any`. Alias `@/*`.
- Añadidos para Serwist: `"@serwist/next/typings"` en `types`, `"webworker"` en `lib`, `public/sw.js` en `exclude`.

### ESLint — `eslint.config.mjs` (flat config, ESLint 9)

Usa `FlatCompat` para puentear configs legacy. Extiende, en orden:

1. `next/core-web-vitals`
2. `next/typescript`
3. `plugin:jsx-a11y/recommended` — set completo de reglas de accesibilidad (la accesibilidad es la razón de ser de la app)
4. `plugin:react-hooks/recommended`
5. `prettier` (`eslint-config-prettier`) — **último**, desactiva reglas de formato que chocan con Prettier

Ignora `.next`, `out`, `build`, `node_modules`, `public/sw.js`, `next-env.d.ts`. Script: `npm run lint` (`eslint`).

> **Wart conocido**: los stubs silencian `no-unused-vars` con `void param`. Al implementar features conviene agregar `argsIgnorePattern: "^_"` al config y limpiarlos. No se hizo aún para no introducir cambios especulativos.

### Prettier — `.prettierrc` + `.prettierignore`

- `semi: false`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: es5`, `printWidth: 100`, plugin `prettier-plugin-tailwindcss`.
- `.prettierignore` excluye build artifacts y además `*.md`, `Dockerfile`, `docker-compose.yml`, `.env.local.example` (la documentación Markdown no se reformatea).
- Scripts: `npm run format` (`--write`) y `npm run format:check`.

---

## Docker y deployment

- **`Dockerfile`**: base **Debian `node:20-bookworm-slim`** (no Alpine — ver DECISIONS.md: `oemer`/`onnxruntime` no tienen wheels musl). Instala Node deps, Python 3 + `oemer` (con `onnxruntime` CPU-only, `pip install --break-system-packages`) y libs de sistema (`libglib2.0-0`, `libgomp1`). `EXPOSE 3000`, arranca con `npm start`.
- **`docker-compose.yml`**: servicio `eco-app`, build `.`, `3000:3000`, `restart: unless-stopped`, `NODE_ENV=production`.
- **`.env.local.example`**: `NEXT_PUBLIC_APP_URL` (reemplazar por la URL del Cloudflare Tunnel en producción).
- Cloudflare Tunnel apunta al puerto 3000.

> La imagen **no se construyó** en esta etapa (sin Docker en el entorno de init). El Dockerfile es coherente con la investigación pero conviene validarlo con un build real antes de confiar en el deploy. Riesgos documentados: imagen >1 GB y descarga de modelos de `oemer` en el primer request a `/api/ocr`.

---

## Verificación (gates que pasan)

| Comando | Resultado |
| --- | --- |
| `npm run lint` | 0 errores, 0 warnings |
| `npm run build` | compila, 12 páginas, sin errores TS |
| `npm run format:check` | limpio |
| `npm run dev` | levanta sin errores (Serwist disabled en dev) |
| Rutas | `/`→307→`/afinador`; las 5 pantallas y `/manifest.webmanifest` 200; `POST /api/ocr` 501 |

---

## Pendientes de la fase de infraestructura — cerrados

Los cinco pendientes que listaba esta sección están resueltos. Se conservan con su resolución porque documentan el paso de la infraestructura base al sistema funcionando:

- **Íconos PWA:** resueltos como SVG (`public/icons/icon-192.svg` y `icon-512.svg`), no como PNG. `app/manifest.ts` los declara con `type: "image/svg+xml"`. La spec §7 todavía muestra PNG en su ejemplo de manifest.
- **Lógica de las pantallas:** las cinco están implementadas, junto con los módulos de `lib/` y `hooks/`. Queda un único stub sin uso, `components/tuner/TunerEngine.tsx`: la lógica de audio terminó viviendo en `hooks/useTuner.ts`.
- **Endpoint `/api/ocr`:** implementado, pero con Tesseract y no con oemer. oemer no reconoce cifrado de acordes, que es justamente lo que `/partitura` necesita leer. Ver la entrada del 2026-07-28 en `DECISIONS.md` y `claude-docs/OCR-PARTITURA.md`.
- **`void param` de los stubs:** ya no existen. Los `void` que quedan (`hooks/useTuner.ts`, `hooks/useMetronome.ts`) son deliberados: descartan promesas de `AudioContext.resume()` y `close()`.
- **Dockerfile:** validado con builds reales. Es el que Railway construye y corre en producción (entrada del 2026-06-30 en `DECISIONS.md`).

La tabla de gates de arriba refleja el estado de esta fase inicial: `POST /api/ocr` ya no responde 501, y hoy hay más rutas que las 12 páginas de entonces.
