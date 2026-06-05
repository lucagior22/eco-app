---
name: crear-feature
description: Guía para crear una nueva feature en eco-app. Analiza el pedido, detecta puntos vagos, hace preguntas de aclaración y espera confirmación explícita antes de pasar al código.
version: 1.0.0
---

# Skill: Crear Feature

## Propósito

Antes de escribir una sola línea de código, asegurarse de que el pedido esté completamente claro y alineado con el proyecto. Este skill obliga a pasar por una fase de análisis y aclaración antes de cualquier implementación.

## Instrucciones para Claude

### Fase 1 — Análisis del pedido

Cuando el usuario invoque este skill con la descripción de una feature:

1. Leé `SPECIFICATION.md` para verificar que la feature esté contemplada o sea coherente con el proyecto.
2. Leé `CLAUDE.md` para recordar las restricciones del stack y las reglas de accesibilidad.
3. Analizá el pedido en busca de:
   - **Ambigüedades**: términos que pueden interpretarse de más de una forma
   - **Puntos faltantes**: comportamientos no especificados (estados de error, casos borde, flujo de foco, TTS, etc.)
   - **Conflictos potenciales**: con la spec existente, el stack, o las reglas de accesibilidad
   - **Suposiciones implícitas**: cosas que el usuario probablemente asume pero no dijo

### Fase 2 — Ronda de preguntas

Presentá las preguntas organizadas por categoría, en prosa clara. No hagas más de 6 preguntas en total. Priorizá las que bloquean la implementación.

Categorías a evaluar (usá solo las relevantes):

- **Comportamiento**: ¿Qué pasa en cada estado? ¿Qué dispara la acción?
- **Accesibilidad**: ¿Cómo se anuncia por TTS? ¿Qué rol ARIA corresponde? ¿Cómo navega el foco?
- **Diseño / UI**: ¿Existe mockup en Figma? ¿Cómo se ve en cada tema?
- **Datos**: ¿De dónde vienen? ¿Se persisten? ¿Qué pasa si no están disponibles?
- **Alcance**: ¿Es una pantalla nueva, un componente, una modificación de algo existente?
- **Criterio de éxito**: ¿Cómo sabemos que la feature está completa y correcta?

Terminá siempre la Fase 2 con esta línea exacta, separada por una línea en blanco:

> Cuando tengas las respuestas, confirmame y arrancamos. **¿Pasamos al código?**

### Fase 3 — Espera de confirmación

**No escribas código, no edites archivos, no planifiques implementación hasta que el usuario responda afirmativamente a "¿Pasamos al código?".**

Respuestas que cuentan como confirmación: "sí", "dale", "pasamos", "adelante", "go", o similar.

Si el usuario responde con más preguntas o aclaraciones, integrá esa información y reformulá si es necesario, luego volvé a preguntar.

### Fase 4 — Plan antes de código

Una vez confirmado, presentá un plan breve:

- Archivos a crear o modificar (con rutas)
- Componentes o hooks involucrados
- Criterios de éxito verificables

Esperá confirmación del plan o ajustes antes de ejecutar.

### Fase 5 — Implementación

Seguí las convenciones de `CLAUDE.md` y los principios del proyecto:
- Cambios quirúrgicos, mínimos
- Accesibilidad no negociable
- Sin features especulativas
- TypeScript estricto, sin `any`

## Ejemplo de uso

```
/crear-feature Quiero agregar un botón de pausa al metrónomo
```

Claude debe responder con análisis + preguntas, NO con código.
