# eco-app — CLAUDE.md

## Contexto del proyecto

App PWA accesible para músicos con discapacidad visual o ceguera.
El usuario principal **no puede ver la pantalla**. La accesibilidad no es un feature: es la razón de existir de la app.
Leé `SPECIFICATION.md` como fuente de verdad antes de empezar cualquier tarea.

---

## Principios de trabajo (basado en Karpathy)

### 1. Pensá antes de codear

No asumas. Si algo no está claro en la tarea, preguntá antes de empezar.
Mostrá tradeoffs explícitamente. No elijas en silencio cuando hay múltiples interpretaciones.

### 2. Simplicidad primero

Código mínimo que resuelve el problema. Nada especulativo, nada "por si acaso".
Preguntate: ¿un senior engineer vería esto y diría "es demasiado"? Si la respuesta es sí, simplificá.
Sin abstracciones hasta que haya 3 o más usos reales.

### 3. Cambios quirúrgicos

Tocá solo lo necesario para la tarea. Mantené el estilo del código existente.
No "mejores" código no relacionado con la tarea. No elimines dead code preexistente.

### 4. Ejecución orientada al objetivo

En tareas de múltiples pasos, presentá un plan breve y esperá confirmación antes de ejecutar.
Definí criterios de éxito verificables para cada tarea.
Al terminar cada feature, ejecutá `npm run build` y verificá que compile sin errores antes de reportar la tarea como completa.

### 5. Informe y validaciones — OBLIGATORIO

El proyecto tiene un `INFORME.md` en la raíz que es entregable académico. Cada vez que el usuario provea resultados de validaciones o contenido para el informe:

- Volcá el contenido en la sección correspondiente de `INFORME.md` de inmediato.
- Marcá el ítem como `✅ Completo` en `claude-docs/VALIDACIONES-MANUALES.md`.
- No dejés secciones del informe con placeholders si el usuario ya aportó el contenido.

Las 6 validaciones manuales requeridas están documentadas en `claude-docs/VALIDACIONES-MANUALES.md`. Todas deben completarse antes de considerar el informe terminado.

---

## Accesibilidad — reglas no negociables

Cada componente interactivo requiere:

- `aria-label` o `aria-labelledby` descriptivo (no solo íconos)
- Rol ARIA correcto si el elemento HTML no es semántico
- Estado ARIA donde aplique (`aria-pressed`, `aria-expanded`, `aria-current`, etc.)
- Foco visible con outline claro (no `outline: none` nunca)

Navegación:

- Flujo de Tab lógico en todas las pantallas
- Teclado completo: Tab, Shift+Tab, Enter, Escape, flechas donde corresponda
- Skip link "Ir al contenido" como primer elemento focusable en cada página

Contenido dinámico:

- Feedback del afinador: `aria-live="polite"`
- Errores y alertas: `aria-live="assertive"`
- Estados de carga: `aria-busy="true"` + mensaje descriptivo

Contraste mínimo WCAG AA:

- Texto normal (< 18px): 4.5:1
- Texto grande (≥ 18px o ≥ 14px bold): 3:1
- Componentes UI e íconos: 3:1

Estructura:

- `lang="es"` en el root HTML
- `<title>` único y descriptivo en cada página
- Un solo `<h1>` por página, jerarquía semántica correcta
- `<main>`, `<nav>`, `<header>` semánticos

Sin degradación:

- La app debe mostrar contenido útil con JS deshabilitado (Next.js SSR)
- La estructura debe ser legible con CSS deshabilitado
- Toda imagen e ícono tiene `alt` o `aria-hidden="true"` si es decorativo

Librería: usá **React Aria** para componentes interactivos complejos. No construyas primitivos accesibles desde cero.

---

## Stack

| Rol             | Tecnología                                          |
| --------------- | --------------------------------------------------- |
| Framework       | Next.js 15 App Router + TypeScript                  |
| Estilos         | Tailwind CSS                                        |
| Accesibilidad   | React Aria (Adobe)                                  |
| PWA             | Serwist (`@serwist/next`)                           |
| Pitch detection | `pitchfinder` (client-side, Web Audio API)          |
| TTS             | Web Speech API nativo                               |
| OCR             | `/api/ocr` route → `child_process` → Tesseract       |
| Estado global   | React Context (sin Redux, sin Zustand)              |
| Persistencia    | `localStorage` para preferencias                    |

---

## Convenciones de código

- **Idioma del código:** TypeScript idiomático, nombres en inglés
- **Idioma de comentarios y documentación:** español
- **Idioma de la UI:** español
- **TypeScript:** sin `any`. Tipado estricto.
- **Tailwind:** clases directamente en JSX. Sin `@apply` salvo casos justificados.
- **Imports:** paths absolutos con `@/` alias

---

## Documentación del proyecto

Este proyecto es un TFI académico. La documentación sirve de evidencia del proceso de diseño e implementación.

### Índice de documentación (.md disponibles)

| Archivo | Propósito |
| --- | --- |
| `SPECIFICATION.md` (raíz) | **Fuente de verdad** funcional y de diseño. Tiene prioridad ante cualquier ambigüedad. |
| `DECISIONS.md` (raíz) | Decisiones de arquitectura/stack que no quedan en el código. Formato: fecha + decisión + razones. |
| `README.md` (raíz) | Entrada pública del proyecto: pantallas, stack, instalación, deployment, accesibilidad. |
| `CLAUDE.md` (raíz) | Este archivo: instrucciones de trabajo para agentes. |
| `AGENTS.md` (raíz) | Reglas para agentes inyectadas por `create-next-app`. Apunta a docs de Next en `node_modules`. Nota: fue generado por la tool de Next 16, pero el proyecto está pineado en **Next 15** (ver `DECISIONS.md`). |
| `claude-docs/README.md` | Índice y propósito de la carpeta `claude-docs/`. |
| `claude-docs/INFRASTRUCTURE.md` | Documentación de la infraestructura base: versiones, estructura, config de tooling, Docker, gates. |
| `claude-docs/COLORS.md` | Sistema de colores: paleta de los 4 temas, ratios WCAG, decisiones de ajuste vs Figma. |
| `claude-docs/VALIDACIONES-MANUALES.md` | Checklist paso a paso de las 6 validaciones manuales requeridas por el enunciado del TFI. |
| `claude-docs/AFINADOR.md` | Funcionamiento técnico de `/afinador`: stack, pipeline de audio, YIN y thresholds, suavizado, modos y narración TTS. |
| `claude-docs/EVAL-AFINADOR.md` | Evaluación heurística crítica de `/afinador`: hallazgos de accesibilidad y diseño/UX priorizados con evidencia archivo:línea. |
| `claude-docs/PEDAL.md` | Funcionamiento técnico de `/pedal`: pipeline de visión, arreglos medidos del detector, votación entre capturas y limitaciones. |
| `claude-docs/OCR-PARTITURA.md` | Funcionamiento técnico de `/api/ocr`: por qué Tesseract y no oemer, pipeline, whitelist de cifrado y capas de filtrado. |

### Carpeta `claude-docs/`

Documentación técnica de trabajo **generada y mantenida por Claude** (notas de infraestructura, implementación, investigación), separada de los docs canónicos de la raíz.

Cuando generes documentación técnica que **no** sea uno de los docs canónicos de la raíz (`SPECIFICATION.md`, `DECISIONS.md`, `README.md`, `CLAUDE.md`), guardala en `claude-docs/` y agregá su entrada **tanto al índice de arriba como al índice en `claude-docs/README.md`**.

### Qué documentar y dónde

**Lógica no obvia → comentario inline (español):**
Comentá el _por qué_, no el _qué_. Solo cuando el razonamiento no es evidente.

```typescript
// YIN necesita buffer de potencia de 2; 2048 da ~46ms de latencia a 44100 Hz — aceptable para afinación en vivo
const BUFFER_SIZE = 2048
```

**Decisiones que desvían de SPECIFICATION.md → anotación en el spec:**
Si algo de la spec resulta inviable o cambia durante la implementación, agregá una nota inline en `SPECIFICATION.md`:

```markdown
> **Implementado:** [descripción de lo que realmente se hizo y por qué difiere]
```

**Contratos de accesibilidad → comentario en el componente:**
Cada componente que maneje ARIA o lógica de foco debe tener un comentario breve al inicio describiendo su contrato de accesibilidad.

```typescript
// Accesibilidad: anuncia cambios de nota via aria-live="polite". El display de frecuencia
// tiene aria-label explícito para no leer el número sin unidad.
```

**Decisiones de arquitectura sin código → `DECISIONS.md` en la raíz:**
Para decisiones significativas que no quedan capturadas en el código (ej. por qué se eligió pitchfinder sobre otra lib, por qué oemer via child_process y no API). Formato: fecha + decisión + razones.

**README.md — mantenerlo actualizado:**
El README es la entrada pública del proyecto (TFI académico + repo público). Actualizalo cada vez que:

- Se completa una pantalla o feature nuevo
- Cambia el proceso de instalación o deployment
- Cambia alguna decisión de stack

Estructura mínima del README:

```markdown
# Eco — Asistente musical accesible

Descripción de una línea.

## Pantallas

Lista de pantallas implementadas con estado (✅ completo / 🚧 en progreso / ⬜ pendiente).

## Stack

Tabla de tecnologías (sin explicar lo obvio).

## Instalación y desarrollo

Comandos para levantar localmente.

## Deployment

Instrucciones Docker + Cloudflare Tunnel.

## Accesibilidad

Qué estándares cumple y cómo validarlo.
```

### Lo que NO documentar

- Lo que ya dicen los nombres de variables/funciones
- El historial de tareas o bugs resueltos (eso va en commits)
- El código de terceros o de la spec

---

## Lo que NO hacer

- No instales librerías que ya resuelve el browser nativo (TTS, Vibration API, MediaDevices)
- No uses `useEffect` para lógica que puede ser síncrona o derivada
- No uses `outline: none` en ningún elemento
- No uses colores como único diferenciador de estado (siempre acompañar con texto/ícono)
- No generes archivos de test — no hay tests en esta etapa
- No agregues features que no estén en `SPECIFICATION.md`
- No uses CSS-in-JS ni styled-components
- No hardcodees strings de UI — mantenelos en español consistente con el prototipo

---

## Comandos útiles

```bash
npm run dev          # desarrollo local
npm run build        # build de producción
npm run lint         # ESLint (incluyendo jsx-a11y)
docker build -t eco-app .
docker-compose up
```

---

## Referencia rápida de pantallas

| Ruta                   | Nombre         | Función principal              |
| ---------------------- | -------------- | ------------------------------ |
| `/`                    | —              | Redirige a `/afinador`         |
| `/afinador`            | Afinador       | Mic → pitch → TTS              |
| `/partitura`           | Leer partitura | Foto/archivo → OCR → acordes   |
| `/metronomo`           | Metrónomo      | BPM + audio/háptico            |
| `/pedal`               | Detectar pedal | Cámara → mock detección → info |
| `/ajustes`             | Ajustes        | Tema, fuente, velocidad TTS    |
| `/informacion`         | Información    | Explicación de cada módulo + FAQ (fuera de la barra de nav) |
