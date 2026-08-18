# claude-docs

Documentación técnica de trabajo **generada y mantenida por Claude**: notas de infraestructura, implementación e investigación.

Está separada de los documentos canónicos de la raíz (`README.md`, `SPECIFICATION.md`, `DECISIONS.md`, `CLAUDE.md`), que son la entrada pública y la fuente de verdad del proyecto. Acá va el detalle técnico de apoyo que no corresponde a ninguno de esos.

## Convención

Cuando generes documentación técnica que no sea uno de los docs canónicos de la raíz, guardala en esta carpeta y agregá su entrada tanto a este índice como al índice maestro en `CLAUDE.md`.

## Índice

| Documento | Contenido |
| --- | --- |
| [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md) | Infraestructura base inicializada: versiones del stack, estructura de archivos, configuración (Serwist, ESLint, Prettier, TS), estado global/tema/navegación, Docker y gates de verificación. |
| [`COLORS.md`](./COLORS.md) | Sistema de colores: paleta completa (4 temas), ratios de contraste WCAG, decisiones de ajuste respecto al Figma, reglas de uso. |
| [`VALIDACIONES-MANUALES.md`](./VALIDACIONES-MANUALES.md) | Checklist paso a paso de las 6 validaciones manuales requeridas por el enunciado: HTML W3C, CSS W3C, sin JS, sin CSS, navegadores, resoluciones. |
| [`AFINADOR.md`](./AFINADOR.md) | Funcionamiento técnico de `/afinador`: stack, pipeline de audio, YIN y thresholds, suavizado, modos y narración TTS. |
| [`EVAL-AFINADOR.md`](./EVAL-AFINADOR.md) | Evaluación heurística crítica de la pantalla `/afinador`: hallazgos de accesibilidad (WCAG AA, lectores de pantalla) y diseño/UX (Nielsen), priorizados con evidencia archivo:línea. |
| [`PEDAL.md`](./PEDAL.md) | Funcionamiento técnico de `/pedal`: pipeline de visión, los tres arreglos medidos del detector, votación entre capturas, identidad estable de las perillas y limitaciones abiertas. |
| [`OCR-PARTITURA.md`](./OCR-PARTITURA.md) | Funcionamiento técnico de `/api/ocr`: por qué Tesseract y no oemer, pipeline de OCR, whitelist de cifrado, capas de filtrado de falsos positivos y limitaciones. |
| [`PROPUESTA-DETECCION-PEDAL.md`](./PROPUESTA-DETECCION-PEDAL.md) | Propuesta (sin implementar) de rediseño de la detección de perillas: diagnóstico del techo del pipeline OpenCV y cuatro opciones comparadas (API de Claude con visión, híbrido con fallback local, rectificación de perspectiva, modelo propio entrenado), con costos, riesgos, análisis de hardware y recomendación. |
