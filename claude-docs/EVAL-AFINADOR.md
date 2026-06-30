# Evaluación heurística — Afinador (/afinador)

- **Fecha:** 2026-06-30
- **Alcance:** exclusivamente la pantalla `/afinador` y todo lo que la envuelve a nivel de layout (header, nav, skip link, tokens de color, foco). No incluye otras pantallas.
- **Metodología:** revisión estática del código contra (a) las reglas no negociables de accesibilidad de `CLAUDE.md`, (b) los criterios WCAG 2.1 AA aplicables, (c) la sección 6.1 de `SPECIFICATION.md` como fuente de verdad funcional, y (d) las heurísticas de Nielsen. Cada hallazgo cita `archivo:línea`. No se ejecutó la app ni lectores de pantalla reales; los hallazgos que dependen de comportamiento en runtime se marcan como tales.

> **Importante para esta app:** el usuario principal **no ve la pantalla**. Por lo tanto el canal de salida real no es el visual sino (1) el TTS propio de la app y (2) lo que un lector de pantalla anuncia desde las regiones `aria-live`. Cualquier información que solo exista en píxeles o en color es, para este usuario, **inexistente**. La evaluación pondera la severidad bajo ese criterio.

---

## Resumen ejecutivo (lo más grave)

1. **Doble voz / conflicto de canales (Alta).** La app habla dos veces en paralelo: el TTS propio de `useTuner` (`announce`) **y** la región `aria-live="polite"` de `TunerDisplay`, que el lector de pantalla del sistema también vocaliza. Para un usuario ciego que usa VoiceOver/NVDA, cada cambio de nota produce solapamiento o eco de la misma información con distinta redacción ("Mi. Afinado." por la app vs. "Mi / Afinado" por el SR). No hay coordinación entre ambos.

2. **Si el narrador se silencia, el usuario ciego queda parcialmente a ciegas — pero no del todo (Media/Alta).** El botón "Narrador" solo apaga el TTS de la app (`ttsEnabled`), no la región `aria-live`. En teoría el SR sigue narrando; pero la región `aria-live` se actualiza **en cada frame de detección** (cada cambio de `detectedNote`/`status`), sin cooldown, mientras que el TTS de la app sí tiene cooldown de 3 s. Resultado probable: con el SR activo la región es verborrágica e interrumpe constantemente; con el SR mal configurado, el usuario pierde feedback. El feedback redundante no está diseñado como fallback consciente.

3. **El indicador de cents (`PitchIndicator`) es 100% invisible para el usuario ciego (Media).** Está marcado `aria-hidden="true"` (`PitchIndicator.tsx:30`) y nunca expone el valor numérico de cents por audio ni por SR. La spec (`SPECIFICATION.md:220`) pide explícitamente `aria-label="Desviación: 2 centavos alto"`. La magnitud de la desviación (¿estoy 2 cents o 45 cents fuera?) nunca llega al usuario: solo recibe "un poco alto/bajo", sin granularidad. Esto degrada la tarea central de afinar.

4. **`aria-pressed` con semántica invertida en los dos botones de acción (Alta).** En "Pausar/Reanudar" (`AfinadorScreen.tsx:117`) y "Narrador" (`AfinadorScreen.tsx:127`) se usa `aria-pressed={!isListening}` y `aria-pressed={!ttsEnabled}`. El SR anunciará "activado/presionado" cuando el micrófono está **pausado** y "no presionado" cuando está **escuchando** — al revés de lo que el usuario espera de un toggle de "encendido". Confunde el estado del sistema.

5. **El selector de micrófono está oculto en mobile (`hidden ... md:flex`) (Media).** `AfinadorScreen.tsx:137`. Un usuario ciego en su teléfono (el caso de uso primario PWA) no puede elegir micrófono ni siquiera sabe que existe. Además depende de `devices.length > 1`, que requiere permiso ya concedido y enumeración exitosa.

---

## Tabla de hallazgos de accesibilidad

| Sev. | Hallazgo | Evidencia (archivo:línea) | Impacto en usuario ciego | Recomendación |
|---|---|---|---|---|
| **Alta** | Doble canal de voz: TTS de la app + región `aria-live` que el SR también lee, sin coordinación. | `useTuner.ts:71-81` (announce), `TunerDisplay.tsx:71` (aria-live polite) | Eco/solapamiento de la misma info en cada cambio de nota; experiencia ruidosa y confusa. | Elegir **un** canal. Recomendado: que la región `aria-live` sea la fuente única (es lo estándar para SR) y que el TTS de la app sea opcional/explícito, o que `aria-live` se desactive (`off`) cuando el TTS de la app está activo. Documentar la decisión en `DECISIONS.md`. |
| **Alta** | `aria-pressed` invertido en botón Pausar/Reanudar. | `AfinadorScreen.tsx:117` | El SR anuncia "presionado" cuando está pausado y viceversa; el estado del sistema se percibe al revés. | Usar `aria-pressed={isListening}` (presionado = micrófono activo) o, mejor, no usar `aria-pressed` y confiar en el `aria-label` dinámico ("Pausar"/"Reanudar"), que ya comunica el estado de forma no ambigua. |
| **Alta** | `aria-pressed` invertido en botón Narrador. | `AfinadorScreen.tsx:127` | Idem: "presionado" cuando el narrador está silenciado. | `aria-pressed={ttsEnabled}` o quitar `aria-pressed` y mantener solo el label dinámico. |
| **Alta** | La región `aria-live` se actualiza en cada frame sin cooldown ni `aria-relevant` controlado. | `TunerDisplay.tsx:71-88`, alimentada por `setDetectedNote/setStatus` en loop `useTuner.ts:189-191, 250-252` | Con SR activo, anuncios incesantes que se pisan; el usuario no llega a procesar uno antes del siguiente. | Anunciar solo en cambios significativos (cambio de nota o de estado afinado/alto/bajo), espejando la lógica de cooldown del TTS. Considerar una región `aria-live` dedicada y minimalista en vez de la zona visual completa. |
| **Media** | `PitchIndicator` totalmente oculto a AT (`aria-hidden`), sin exponer magnitud de cents. La spec lo pide. | `PitchIndicator.tsx:30`; spec `SPECIFICATION.md:220` | El usuario nunca conoce la magnitud de la desviación; solo "un poco alto/bajo". Afinar fino se vuelve imposible sin ver. | Exponer la desviación numérica vía SR/TTS: p. ej. "Desviación: 12 cents alto", o un texto `sr-only` con `aria-live` controlado. Mantener la barra visual `aria-hidden`. |
| **Media** | Selector de micrófono oculto en mobile (`hidden ... md:flex`). | `AfinadorScreen.tsx:137` | En el dispositivo primario (teléfono) el usuario ciego no puede cambiar de micrófono ni sabe que la opción existe. | Mostrarlo también en mobile (es un `<select>` nativo, ya accesible) o exponerlo en Ajustes. Como mínimo, no ocultarlo solo por viewport. |
| **Media** | Estado de error solo se anuncia; pero al entrar en estado de error desaparece **todo** el resto de la UI (early return). | `AfinadorScreen.tsx:70-81` | Bien que use `role="alert"` + `aria-live="assertive"`. Pero no hay acción de reintento accesible: el usuario ciego oye el error y queda sin camino (debe ir a config del navegador). | Agregar un botón "Reintentar" que reinvoque `openStream()` (hoy `useMicrophone` no lo expone). Mejora control y libertad del usuario. |
| **Media** | "Solicitando permiso de micrófono" usa `aria-busy` + `aria-label` en un `<div>` no-live; no garantiza anuncio. | `AfinadorScreen.tsx:83-93` | El estado de carga puede no anunciarse: `aria-busy` en un contenedor estático no dispara lectura automática en todos los SR. El usuario ciego puede quedar sin saber que la app está esperando permiso. | Poner el texto en una región `aria-live="polite"` (o `role="status"`), no solo `aria-label` en un div. |
| **Media** | Texto de instrucción clave aparece/desaparece según selección sin región live. | `TunerDisplay.tsx:65-69` ("Tocá una cuerda para modo automático…") | El usuario ciego no recibe esta guía de uso por audio salvo que navegue hasta ahí con el SR; es la única explicación del modo automático vs. cuerda. | Asegurar que esta instrucción sea alcanzable por el SR de forma estable (no condicional a estado visual) o anunciarla al cambiar de modo. |
| **Baja** | Color como (casi) único diferenciador del estado de cuerda activa vs. seleccionada. La activa es verde, la seleccionada es accent; el `aria-label` distingue "seleccionada" pero no "activa/sonando". | `TunerDisplay.tsx:42-59` | Para el SR, la cuerda que **está sonando** en modo automático no se distingue de las demás (solo cambia color). | Añadir al `aria-label`/estado un indicador textual de "sonando ahora" para la cuerda activa, o reflejarlo vía la región live de nota. |
| **Baja** | Foco visible: correcto y consistente (`:focus-visible` global 3px + outline en botones). Sin `outline:none` detectado. | `globals.css:98-101`, `AfinadorScreen.tsx:19,145`, `TunerDisplay.tsx:51` | Positivo. Sin impacto negativo. | Mantener. Verificar contraste del outline contra el tint de fondo dinámico (ver UX). |
| **Baja** | Iconos SVG decorativos correctamente `aria-hidden`. | `AfinadorScreen.tsx:23,32,40,50` | Positivo: no se leen íconos sin sentido. | Mantener. |
| **Baja** | Estructura semántica correcta: un solo `<h1>` (PageHeader), `<main>`, `<nav>`, `lang="es"`, `<title>` único. | `app/layout.tsx:64,77`, `PageHeader.tsx:12`, `page.tsx:6` | Positivo. | Mantener. Verificar que `AfinadorScreen` no introduzca un segundo `h1` (no lo hace). |
| **Baja (no verificable estáticamente)** | Degradación sin JS: el afinador es `'use client'` y depende de Web Audio + estado; sin JS no hay funcionalidad ni mensaje. | `AfinadorScreen.tsx:1`, toda la lógica en hooks cliente | El afinador es intrínsecamente interactivo; sin JS no puede funcionar. CLAUDE.md pide "contenido útil sin JS". | Aceptable funcionalmente, pero el SSR debería renderizar al menos el `<h1>` y un mensaje "Requiere JavaScript para detectar el tono". El PageHeader sí es server-render; confirmar que aparece sin JS. |

---

## Tabla de hallazgos de diseño / UX (Nielsen)

| Heurística | Sev. | Hallazgo | Recomendación |
|---|---|---|---|
| Visibilidad del estado del sistema | Alta | El tint de fondo por cents (`getTintColor`, `AfinadorScreen.tsx:12-17`) comunica "qué tan afinado" **solo por color**, invisible para el usuario ciego y además puede reducir el contraste del texto/outline sobre el card. La info de magnitud no existe en audio (ver hallazgo PitchIndicator). | Trasladar la magnitud a audio/SR. Verificar contraste del texto y del outline de foco sobre el `hsla(...,0.35)` superpuesto. |
| Visibilidad del estado del sistema | Media | "Escuchando…" (`STATUS_LABELS.silent`, `TunerDisplay.tsx:16`) se muestra tanto al inicio como tras `HOLD_MS` sin señal. El usuario ciego no distingue "esperando que toques" de "dejé de oírte". | Diferenciar mensajes: "Tocá una cuerda" vs. "Sin señal". |
| Correspondencia con el mundo real | Baja (positivo) | Nombres de notas en español correctos (Do/Re/Mi…), narración en `es-AR`. | Mantener (`pitch.ts:6-19`, `tts.ts:19`). |
| Control y libertad del usuario | Media | Ante error de micrófono no hay reintento dentro de la app (ver tabla a11y). El único "deshacer" es ir a la config del navegador. | Botón "Reintentar". |
| Prevención de errores | Media | Si el TTS del navegador no está soportado, `speak` cae silenciosamente (`tts.ts:9-11`) y el usuario ciego con el narrador como único canal no recibe nada ni aviso. | Si `!isTtsSupported()`, asegurar que la región `aria-live` quede como canal y/o avisar una vez "Narrador del sistema no disponible". |
| Flexibilidad y eficiencia | Media | Selección de cuerda y modo automático son potentes pero su descubrimiento depende de texto visual condicional (`TunerDisplay.tsx:65-69`). Un usuario ciego puede no enterarse de que puede fijar una cuerda. | Anunciar el modo y la ayuda al entrar; ya se anuncia "Modo automático"/"Afinando X" al cambiar (`useTuner.ts:92-97`), pero no al cargar la pantalla por primera vez si el TTS está on — verificar que el primer render lo dispare. |
| Estética y diseño minimalista | Baja | El display visual es limpio y grande (text-8xl), bien para baja visión. | Mantener; confirmar que el verde de "afinado" sobre surface cumple 3:1 a ese tamaño (lo cumple según COLORS.md). |
| Ayuda y documentación | Baja | No hay ayuda contextual audible sobre cómo operar el afinador solo con audio. | Considerar una breve guía audible opcional la primera vez. |
| Flujo solo-audio | Alta | **Pregunta central: ¿es operable solo con audio y teclado?** Parcialmente. El usuario puede tabular a los botones y al selector de cuerda, y oye el resultado vía TTS. Pero (a) el TTS y el SR se pisan, (b) la magnitud de cents no es audible, (c) en mobile no hay selector de mic, (d) si el TTS de la app se silencia, el fallback (`aria-live`) es verborrágico. | Resolver los 4 puntos. El objetivo: un único canal de audio coherente, con magnitud, operable con teclado en cualquier viewport. |

---

## Conclusión

La pantalla tiene cimientos accesibles sólidos: semántica de landmarks correcta, foco visible global de 3px sin `outline:none`, íconos decorativos ocultos, labels en los controles, narración en español y tokens de color con contraste WCAG AA documentado. El esqueleto está bien.

El problema central no es la falta de ARIA sino la **arquitectura del canal de salida para el usuario que no ve**: hay dos voces compitiendo (TTS propio + región `aria-live`), una de ellas sin throttling; la magnitud de la desviación —el dato más útil para afinar— está encerrada en un componente `aria-hidden`; y dos `aria-pressed` invertidos comunican el estado al revés. Para una app cuya razón de existir es la accesibilidad, estos no son detalles: son el producto.

### Top 3 acciones prioritarias

1. **Unificar el canal de audio.** Decidir entre TTS de la app o región `aria-live` como fuente única y desactivar la otra (o sincronizarlas con el mismo cooldown). Evita el eco y la verborrea. Documentar en `DECISIONS.md`.
2. **Exponer la magnitud de la desviación por audio** (cumplir `SPECIFICATION.md:220`): "Desviación: N cents alto/bajo", manteniendo la barra visual `aria-hidden`. Sin esto no se puede afinar fino sin ver.
3. **Corregir los `aria-pressed` invertidos** de Pausar/Reanudar y Narrador (`AfinadorScreen.tsx:117,127`), y mostrar el selector de micrófono también en mobile (`AfinadorScreen.tsx:137`).
