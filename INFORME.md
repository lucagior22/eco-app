# Informe — Eco: Asistente Musical Accesible

# Parte 1 — Investigación y evaluación de accesibilidad

---

## 1.1 Decisiones de accesibilidad

La accesibilidad no se trató como una lista de requisitos a cumplir al final, sino como el criterio principal de cada decisión de diseño. Algunos ejemplos concretos de cómo eso influyó en la implementación:

**El problema del botón invisible.** En la pantalla de pedal, el usuario tiene que apuntar la cámara a un objeto físico y después presionar un botón. Si es ciego, no sabe que la cámara ya está activa ni dónde está el botón. La solución fue combinar dos acciones automáticas al inicializar la cámara: narrar una instrucción por voz ("Cámara lista. Presioná el botón Detectar pedal...") y mover el foco del teclado directamente al botón. El usuario escucha la instrucción y puede actuar de inmediato.

```tsx
useEffect(() => {
  if (isActive) {
    onReady?.()                // narra la instrucción
    buttonRef.current?.focus() // lleva el foco al botón
  }
}, [isActive])
```

**Acordes en español para TTS.** Los nombres de acordes en notación estándar son ininteligibles para un sintetizador de voz: "Bm" se leería "bi eme", "C#maj7" no significa nada hablado. Se implementó `chordToSpanish()` que convierte cualquier acorde antes de pasarlo al narrador: "Am" → "La menor", "C#maj7" → "Do sostenido mayor séptima". Un caso especial es "Bm": sin la conversión el TTS diría "Sim", que es un homófono de "sí mismo" y genera confusión.

**Color nunca como único diferenciador.** El estado del LED en la pantalla de pedal se muestra con un círculo de color más texto explícito ("Encendido" / "Apagado"). El ítem activo en la navegación tiene `aria-current="page"` y un subrayado visible, no solo un cambio de color. Esto cubre tanto a usuarios con daltonismo como a quienes usan lectores de pantalla.

**Narrador como primer foco en el afinador.** La pantalla `/afinador` tiene seis botones de selección de cuerda que aparecen visualmente primero, pero en términos de orden de tabulación eso crea un problema: un usuario ciego llega a la pantalla y no puede silenciar el narrador antes de que empiece a hablar, porque el foco cae primero en las cuerdas. La solución fue reordenar el DOM para que los botones de control (Narrador y Pausar) queden antes del display del afinador, sin modificar el layout visual. Así el primer Tab del usuario llega al botón Narrador, que puede activar o desactivar antes de que el audio empiece.

**Anti-flash de tema.** Al cargar la app, existe un instante donde JavaScript todavía no corrió y el tema guardado no está aplicado. Para evitar ese flash visual, se ejecuta un script síncrono en el `<head>` que lee las preferencias de `localStorage` y aplica los atributos al `<html>` antes del primer render.

---

## 1.2 Implementación técnica de accesibilidad

### Estructura semántica

Todas las páginas comparten el mismo contrato: `<html lang="es">`, `<title>` único en cada ruta, un solo `<h1>` por página, y landmarks semánticos (`<main>`, `<nav>`, `<header>`). El primer elemento focusable de cada página es un skip link que aparece solo al recibir foco.

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
  Ir al contenido principal
</a>
```

### ARIA

Cada componente interactivo tiene roles y estados explícitos:

- `aria-label` en botones cuyo texto visible no es suficientemente descriptivo
- `aria-current="page"` en el ítem activo de la navegación
- `aria-live="polite"` para anuncios no urgentes (cambio de ajuste, resultado de detección)
- `aria-live="assertive"` para errores y estados de carga
- `aria-busy="true"` durante el procesamiento OCR
- `role="alert"` en mensajes de error
- `role="group"` con `aria-labelledby` en los controles carrusel

### Navegación por teclado

Toda la app es operable sin mouse. Tab y Shift+Tab recorren los elementos en orden lógico, Enter y Espacio activan acciones, y las teclas de flecha navegan entre opciones en los controles de ajustes. No hay trampas de foco.

### Contraste de color

Los cuatro temas cumplen WCAG 2.2 nivel AA o superior:

| Tema                  | Ratio texto/fondo |
| --------------------- | ----------------- |
| Claro                 | ~7:1              |
| Oscuro                | ~18:1             |
| Alto contraste claro  | 21:1              |
| Alto contraste oscuro | 21:1              |

### Tipografía

El default es Atkinson Hyperlegible, diseñada por el Braille Institute para usuarios con baja visión. Sus formas abiertas y la alta diferenciación entre caracteres similares (1/l/I, 0/O) reducen la ambigüedad especialmente en partituras y nombres de acordes.

---

## 1.3 Evaluación

### Validador HTML W3C — pantalla `/pedal`

Se validó el HTML de la pantalla `/pedal` mediante validator.w3.org por URI.

**Resultado: 0 errores, 0 warnings.**

Los avisos `Info` sobre *trailing slash on void elements* (`<meta/>`, `<link/>`) son comportamiento de React/JSX: el servidor renderiza elementos void con cierre explícito (`/>`). Es sintaxis XHTML válida en HTML5 y no constituye error.

---

### Validador CSS W3C — pantalla `/pedal`

Se validó el CSS de la pantalla `/pedal` mediante jigsaw.w3.org/css-validator por URI (perfil CSS Level 3 + SVG).

**Resultado: 32 errores, 140 warnings.**

El validador analiza el archivo CSS generado por el build de Tailwind (`_next/static/css/c07233ad255fff54.css`). Todos los errores son falsos positivos producidos por una incompatibilidad entre el perfil del validador y la versión del framework utilizado: ninguno corresponde a código escrito en la app ni indica un problema funcional.

**Por qué ocurre esto**

El validador W3C opera con el perfil **CSS Level 3**. Tailwind CSS v4 — la versión usada en este proyecto — adoptó `@property` como parte central de su arquitectura. Esta regla pertenece a la especificación **CSS Properties & Values API Level 1** (parte de CSS Houdini), una spec posterior a CSS3 que el validador no reconoce. El resultado es que 30 de los 32 errores son instancias del mismo falso positivo: el validador no conoce `@property`.

Tailwind v4 genera bloques como el siguiente para tipar sus custom properties de gradientes, sombras y transiciones:

```css
@property --tw-gradient-from {
  syntax: "<color>";
  inherits: false;
  initial-value: transparent;
}
```

Esto es comportamiento de diseño del framework y no puede eliminarse sin abandonar Tailwind v4. La regla `@property` tiene soporte completo en todos los navegadores modernos (Chrome, Firefox, Edge, Safari).

**Conclusión:** los errores reportados no son defectos del código sino una limitación del perfil de validación CSS Level 3 frente a un framework moderno. El CSS funciona correctamente en producción. Este resultado ilustra una tensión real en el ecosistema web: los validadores oficiales de la W3C no siempre reflejan el estado actual de las especificaciones que la misma W3C publica.

---

### WAVE — pantalla `/pedal`

Se evaluó la pantalla de detección de pedal con WAVE (Web Accessibility Evaluation Tool). Es la pantalla más compleja del sistema en términos de accesibilidad, ya que combina video en vivo, detección con feedback hablado y estado dinámico.

**Resultado: AIM Score 10/10. 0 errores.**

| Categoría       | Resultado |
| --------------- | --------- |
| Errors          | 0         |
| Contrast Errors | 0         |
| Alerts          | 1         |
| Features        | 1         |
| Structure       | 5         |
| ARIA            | 11        |

La única alerta corresponde al elemento `<video>` sin subtítulos (`<track>`), lo cual es técnicamente correcto según WCAG pero no aplica en este contexto: el video es un stream de cámara en vivo, no contenido multimedia con audio. No se agrega una pista de subtítulos porque no hay audio que transcribir.

---

### Criterios WCAG 2.2 verificados manualmente

| Criterio | Descripción                 | Resultado                                                |
| -------- | --------------------------- | -------------------------------------------------------- |
| 1.1.1    | Contenido no textual        | ✅ Íconos decorativos marcados `aria-hidden`              |
| 1.3.1    | Información y relaciones    | ✅ `dl`, `nav`, `main`, `header` correctamente usados     |
| 1.3.3    | Características sensoriales | ✅ Estado del LED y nav activa usan texto además de color |
| 1.4.3    | Contraste mínimo            | ✅ Cumple AA en todos los temas                           |
| 2.1.1    | Teclado                     | ✅ Navegación completa sin mouse                          |
| 2.4.1    | Evitar bloques              | ✅ Skip link en todas las páginas                         |
| 2.4.2    | Página con título           | ✅ Title único en cada ruta                               |
| 2.4.7    | Foco visible                | ✅ Outline visible en todos los elementos focusables      |
| 3.1.1    | Idioma de la página         | ✅ `lang="es"` en `<html>`                                |
| 4.1.2    | Nombre, función, valor      | ✅ Roles y estados ARIA correctos                         |

---

### Sin JavaScript

Se deshabilitó JavaScript desde Chrome DevTools y se navegaron las tres pantallas principales en la versión desplegada en Vercel.

| Elemento                                 | Resultado                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Navegación principal                     | ✅ Renderiza correctamente vía SSR                                       |
| Títulos y descripciones de cada pantalla | ✅ Visibles — Next.js sirve el HTML completo                             |
| Botones de ajustes                       | ⚠️ No responden — requieren event handlers de React                     |
| Habilitación de cámara (`/pedal`)        | ⚠️ Permanece en estado "Iniciando cámara" — requiere `MediaDevices API` |
| Habilitación de micrófono (`/afinador`)  | ⚠️ No se activa — requiere `Web Audio API`                              |

El comportamiento es correcto. La app es una PWA que opera sobre APIs de browser (MediaDevices, Web Audio, Web Speech) que son inherentemente dependientes de JavaScript. Sin JS, Next.js entrega el HTML estructural completo vía SSR — títulos, navegación, descripciones — cumpliendo el requisito de contenido útil sin scripts. Las funcionalidades interactivas quedan en su estado inicial, no en una pantalla en blanco.

---

### Sin CSS

Se deshabilitaron todos los estilos y se navegaron las pantallas principales.

**Resultado: contenido legible y funcional.**

Sin hojas de estilo, la app muestra el HTML estructural en orden lógico: título, descripción, navegación, controles. Los botones e inputs son reconocibles como elementos interactivos nativos del browser. Las funcionalidades (cámara, ajustes) siguen operando porque no dependen de CSS. El contenido no se pierde ni se superpone — la jerarquía semántica del HTML sostiene la legibilidad por sí sola.

Esto es resultado directo de las decisiones de estructura tomadas durante el desarrollo: uso de elementos HTML semánticos (`<main>`, `<nav>`, `<header>`, `<button>`) en lugar de `<div>` genéricos, y un orden de nodos en el DOM que refleja el flujo lógico de la pantalla.

---

### Diferentes navegadores

Se probó la app en cuatro navegadores distintos, verificando layout, navegación por teclado y funcionamiento de las APIs de browser (cámara, micrófono, TTS).

| Navegador | Motor | Resultado                |
| --------- | ----- | ------------------------ |
| Chrome    | Blink | ✅ Funciona correctamente |
| Brave     | Blink | ✅ Funciona correctamente |
| Edge      | Blink | ✅ Funciona correctamente |
| Firefox   | Gecko | ✅ Funciona correctamente |

El comportamiento es consistente en todos los navegadores probados. Las APIs utilizadas (MediaDevices, Web Audio, Web Speech) tienen soporte completo en los distintos motores modernos.

---

### Diferentes resoluciones

Se probó el layout en distintas resoluciones usando Chrome DevTools (modo responsive).

| Resolución | Dispositivo | Resultado                              |
| ---------- | ----------- | -------------------------------------- |
| 375×667    | iPhone SE   | ✅ Funcional — con excepción nota abajo |
| 390×844    | iPhone 14   | ✅ Funciona correctamente               |
| 1280×800   | Laptop      | ✅ Funciona correctamente               |
| 1920×1080  | Desktop     | ✅ Funciona correctamente               |

**Observación — fuente muy grande en pantalla pequeña:**

En iPhone SE (375px de ancho) con la fuente configurada en tamaño muy grande desde `/ajustes`, algunos elementos desbordan la pantalla. Este es el único caso de overflow detectado, y se da en la combinación del dispositivo más pequeño con la opción de fuente más grande.

---

# Parte 2 — Desarrollo

---

## 2.1 Descripción del proyecto

Eco nació de una observación simple: la mayoría de las herramientas musicales digitales asumen que quien las usa puede ver la pantalla. Para un músico ciego o con baja visión, eso significa que un afinador de guitarra, una app de partituras o un identificador de pedales son básicamente inutilizables. Eco intenta resolver eso.

El sistema cubre cuatro funciones: afinar un instrumento con feedback hablado, leer partituras mediante reconocimiento óptico, identificar pedales de efectos usando la cámara, y personalizar la experiencia visual y auditiva. Todo operado por teclado o lector de pantalla.

Está construido sobre Next.js 15, TypeScript y Tailwind CSS. Para las funciones de cámara, voz y audio se usan las APIs nativas del navegador sin librerías externas.

---

## 2.2 Estado de la versión inicial

| Pantalla                           | Estado                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Ajustes (`/ajustes`)               | ✅ Completo                                                                |
| Detectar pedal (`/pedal`)          | ✅ Completo (detección mock)                   |
| Leer partitura (`/partitura`)      | 🚧 UI e integración backend implementadas — OCR sin validar en producción |
| Afinador (`/afinador`)             | 🚧 Estructura definida, lógica pendiente                                  |
| Metrónomo (`/partitura/metronomo`) | 🚧 Estructura definida, lógica pendiente                                  |

---

## 2.3 Conclusiones

La versión inicial demuestra que es posible construir herramientas musicales que funcionen igual de bien para un usuario ciego que para uno con visión. La pantalla de pedal es el ejemplo más claro: guía al usuario a través de una tarea de visión — apuntar la cámara a un objeto físico — sin requerir ninguna exploración visual, y obtiene la máxima puntuación en la evaluación de accesibilidad.

Lo que está pendiente son las funcionalidades centrales del Afinador y el Metrónomo, y la validación del reconocimiento OCR de partituras en el entorno de producción. La base técnica y de accesibilidad para esas pantallas ya está definida.

Una cosa que quedó clara durante el desarrollo es que diseñar para usuarios ciegos mejora la experiencia para todos. El foco automático al botón, el TTS al inicializar la cámara, la narración de acordes en español — son soluciones que también ayudan a alguien con movilidad reducida o simplemente a alguien que prefiere no tener que buscar con la vista cada vez que abre la app.
