# DECISIONS.md — Eco

Registro de decisiones de arquitectura que no quedan evidentes en el código.
Formato: fecha + decisión + razones.

---

## 2026-06-01 — Next.js 15 (no 16)

**Decisión:** Se pineó Next.js en la versión 15.x (15.5.19).

**Razones:**
`@serwist/next` (el plugin PWA elegido) depende de `@serwist/webpack-plugin`, que requiere webpack como bundler. Next.js 16 hace Turbopack el bundler por defecto para `next build`, y Turbopack no soporta plugins de webpack. Un build con Serwist en Next 16 falla a menos de forzar `--webpack` en cada comando. Para evitar esa fricción y garantizar compatibilidad, se usa Next 15 hasta que Serwist declare soporte oficial para Next 16 / Turbopack.

---

## 2026-06-01 — react-aria-components (no react-aria)

**Decisión:** Se usa `react-aria-components` (la API de componentes de alto nivel de Adobe).

**Razones:**
La spec §2 lo especifica explícitamente. `react-aria-components` provee componentes accesibles listos para usar (Button, Select, Dialog, etc.) que cumplen WCAG sin construir primitivos a mano. `react-aria` (hooks de bajo nivel) requeriría implementar toda la lógica ARIA manualmente, lo que contradice el principio de simplicidad del proyecto y aumenta el riesgo de errores de accesibilidad.

---

## 2026-06-01 — pitchfinder con algoritmo YIN

**Decisión:** Se usa `pitchfinder` con el algoritmo YIN para detección de pitch client-side.

**Razones:**
YIN es robusto en señales monofónicas de instrumentos (guitarra, bajo, viento) y tiene baja tasa de error comparado con ACF o MPM. `pitchfinder` incluye tipos TypeScript propios (sin `@types/pitchfinder`), es liviano y corre íntegramente en el browser vía Web Audio API, sin enviar audio a servidores. Buffer de 2048 muestras da ~46 ms de latencia a 44100 Hz, aceptable para afinación en vivo.

---

## 2026-06-01 — oemer vía child_process (no API externa)

**Decisión:** El OCR/OMR (reconocimiento óptico de partituras) se invoca localmente como proceso Python desde `/api/ocr/route.ts` usando `child_process`.

**Razones:**
Mantiene el procesamiento local sin dependencias de servicios externos ni costos por uso. oemer es la herramienta de OMR open source más madura para Python; invocarlo vía `child_process` es la integración más simple posible desde un API route de Next.js. No hay API REST oficial de oemer que simplificaría este approach.

---

## 2026-06-01 — Imagen base Debian Bookworm (no Alpine)

**Decisión:** El Dockerfile usa `node:20-bookworm-slim` en lugar de `node:20-alpine` como especifica la spec §8.

**Razones:**
oemer depende de `onnxruntime-gpu`, cuyos wheels en PyPI son exclusivamente manylinux (glibc 2.27+). Alpine Linux usa musl libc: pip no puede instalar esos wheels. La alternativa de Alpine (`py3-onnxruntime` en el repo edge/community) es el paquete CPU sin la variante `-gpu`, y no garantiza compatibilidad de API con lo que oemer importa. Compilar onnxruntime desde fuente en Alpine es factible pero agrega horas al build y complejidad de mantenimiento. Debian bookworm tiene glibc → los wheels manylinux instalan sin problemas. La diferencia de tamaño de imagen (bookworm-slim vs alpine) es aceptable dado que la imagen ya es pesada por Python + oemer + sus dependencias ML.

---

## 2026-06-01 — onnxruntime CPU-only (no onnxruntime-gpu)

**Decisión:** Se instala `onnxruntime` (CPU) antes de `oemer` en el Dockerfile para evitar que pip instale `onnxruntime-gpu`.

**Razones:**
El servidor de deployment (Ubuntu local) no tiene GPU NVIDIA ni CUDA. `onnxruntime-gpu` instalaría dependencias CUDA innecesarias y agregaría cientos de MB a la imagen. `onnxruntime` (CPU) expone la misma API que usa oemer internamente; al estar ya satisfecha la dependencia cuando pip procesa oemer, no intenta instalar la variante `-gpu`. El OMR corre más lento en CPU (~3–5 min por partitura según la doc de oemer) pero es funcional para el caso de uso académico.

---

## 2026-06-01 — Serwist (@serwist/next) para PWA

**Decisión:** Se usa `@serwist/next` como capa de service worker y PWA manifest.

**Razones:**
Es el sucesor mantenido de `next-pwa` (deprecado). Integra service worker con precache vía Workbox y tiene soporte para App Router de Next.js. Alternativas como `next-pwa` están sin mantenimiento activo; construir el service worker a mano sería innecesariamente complejo para los requisitos del proyecto.

---

## 2026-06-01 — React Context para estado global (no Redux / Zustand)

**Decisión:** El estado global (preferencias de accesibilidad) se maneja con React Context.

**Razones:**
El estado es mínimo: un objeto `EcoSettings` con tres campos (tema, tamaño de fuente, velocidad TTS). No hay acciones asíncronas ni estado derivado complejo. Agregar Redux o Zustand sería sobre-ingeniería clara para este volumen de estado. Context con `localStorage` para persistencia resuelve el problema con el mínimo de dependencias.

---

## 2026-06-01 — Deployment local + Cloudflare Tunnel

**Decisión:** La app se despliega en Docker sobre Ubuntu Server local, expuesta a internet vía Cloudflare Tunnel apuntando al puerto 3000.

**Razones:**
Evita costos de nube (VPS, CDN). Cloudflare Tunnel provee HTTPS, protección DDoS y un dominio público sin abrir puertos en el router. El caso de uso es académico/demo con tráfico mínimo; la latencia extra del tunnel es aceptable. No se requiere orquestación compleja (Kubernetes, etc.).

---

## 2026-06-01 — Tailwind CSS v4

**Decisión:** Se usa Tailwind CSS v4 (config CSS-first, sin `tailwind.config.js`).

**Razones:**
Es la versión scaffoldeada por `create-next-app` al momento de inicializar el proyecto. La configuración CSS-first de v4 (`@import "tailwindcss"` en globals.css) elimina el archivo de configuración JS y reduce fricción. No hay razón para degradar a v3.
