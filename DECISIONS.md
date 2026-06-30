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

## 2026-06-05 — Afinador: AnalyserNode + requestAnimationFrame (no ScriptProcessorNode)

**Decisión:** La captura de audio usa `AnalyserNode` + `getFloatTimeDomainData` en un loop `requestAnimationFrame`, no `ScriptProcessorNode` ni `AudioWorklet`.

**Razones:**
`ScriptProcessorNode` entrega buffers zerizados de forma intermitente en Chromium/Windows (bug conocido del scheduler). `AudioWorklet` requiere un archivo worker separado y más boilerplate. El patrón `AnalyserNode + rAF` es el canónico de la implementación de referencia cwilso/PitchDetect: funciona en todos los browsers modernos, no tiene el bug de Chromium, y es significativamente más simple. Se agrega un `GainNode` con `gain=0` conectado al `destination` para forzar el procesamiento del grafo de audio (sin él, Chrome puede no enviar muestras al `AnalyserNode`).

---

## 2026-06-05 — Afinador: nota basada en cuerda más cercana (no MIDI cromático)

**Decisión:** En modo automático, la nota mostrada y narrada se deriva de la cuerda de guitarra más cercana en frecuencia (`closestStringIndex`), no del cálculo MIDI cromático estándar.

**Razones:**
`frequencyToNote` (MIDI) redondea al semitono más cercano en la escala cromática. Si la cuerda B (246.94 Hz) está 50+ cents sostenida, el cálculo MIDI devuelve C (261.63 Hz) y el afinador anunciaría "Do". Un afinador de guitarra debe decir "Si: un poco alto", no "Do". Usando la cuerda como referencia, el nombre siempre corresponde a la cuerda que el usuario está afinando, y los cents expresan la desviación respecto a la afinación estándar de esa cuerda.

---

## 2026-06-05 — Afinador: histéresis en umbral de afinado

**Decisión:** El estado "afinado" usa dos umbrales distintos: entra en "afinado" con ≤10 cents de desviación, pero permanece en "afinado" hasta superar los 20 cents (histéresis).

**Razones:**
Un umbral único de 10 cents provoca flip-flop cuando la cuerda está en el borde: una detección en 8 cents → "afinado", la siguiente en 12 cents → "bajo", alternando entre dos estados en tocadas consecutivas. La histéresis elimina esta oscilación sin sacrificar precisión: el usuario entra en "afinado" con ±10 cents y la narración se mantiene estable hasta que la cuerda se desafine claramente.

---

## 2026-06-05 — Afinador: modo cuerda-a-cuerda

**Decisión:** Se agregó un modo de selección de cuerda individual: el usuario elige una cuerda (E A D G B E) y la detección se filtra a esa frecuencia con normalización de octava.

**Razones:**
En modo automático, el algoritmo YIN puede confundir cuerdas adyacentes o detectar armónicos. La normalización de octava en `centsToTarget` permite que tanto E2 detectado como E3 (armónico) computen la misma desviación en cents respecto a la cuerda seleccionada. Esto mejora significativamente la consistencia de detección, en particular para la 6ª cuerda (E2 = 82 Hz, señal débil).

---

## 2026-06-05 — Afinador: pausa durante TTS para evitar feedback

**Decisión:** La detección de pitch se pausa mientras el sintetizador de voz está activo (`isSpeakingRef`), y se reanuda 300 ms después del evento `onend`.

**Razones:**
Sin pausa, el audio del TTS es captado por el micrófono. YIN interpreta la señal de voz como una nota musical, generando detecciones espurias que a su vez disparan más locuciones TTS. El ciclo de retroalimentación hace la pantalla inutilizable. La pausa de 300 ms post-`onend` da tiempo al sistema de audio a drenar antes de retomar la captura.

---

## 2026-06-01 — Tailwind CSS v4

**Decisión:** Se usa Tailwind CSS v4 (config CSS-first, sin `tailwind.config.js`).

**Razones:**
Es la versión scaffoldeada por `create-next-app` al momento de inicializar el proyecto. La configuración CSS-first de v4 (`@import "tailwindcss"` en globals.css) elimina el archivo de configuración JS y reduce fricción. No hay razón para degradar a v3.

---

## 2026-06-30 — Afinador: canal único de audio (TTS primario + aria-live fallback)

**Decisión:** El feedback al usuario que no ve viaja por un solo canal coherente. `useTuner` es la fuente única del texto a anunciar (`announcement`), gobernada por la misma lógica de cambio-significativo + cooldown de 3 s que el TTS. El TTS propio de la app es el canal primario; la región `aria-live` (única, `role="status"` y `sr-only` en `AfinadorScreen`) actúa como fallback y queda en `off` cuando el narrador está activo y el navegador soporta Web Speech, o en `polite` en caso contrario. El bloque visual de `TunerDisplay` deja de ser `aria-live`. El anuncio incluye la magnitud de la desviación ("Mi. 12 centavos alto.").

**Razones:**
Antes la app hablaba dos veces en paralelo: el TTS de `useTuner` y la región `aria-live` de `TunerDisplay`, que el lector de pantalla también vocalizaba, sin coordinación ni throttling en la segunda (se actualizaba en cada frame). Para un usuario ciego con VoiceOver/NVDA esto producía eco y verborrea constante. Centralizar el texto en `announcement` y conmutar `aria-live` según `ttsEnabled`/`isTtsSupported` elimina el solapamiento, hereda el throttling del TTS, y garantiza que siempre haya exactamente un canal hablando (incluso si el narrador se silencia o el navegador no soporta Web Speech). Incluir el número de cents cumple la intención de `SPECIFICATION.md:220`: sin la magnitud audible, afinar fino sin ver es imposible.
