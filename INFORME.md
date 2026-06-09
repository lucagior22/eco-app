# Informe de Desarrollo — Eco: Asistente Musical Accesible

**Materia:** Diseño de Interfaces Web  
**Entrega:** Versión inicial del sistema  
**Aplicación:** PWA accesible para músicos con discapacidad visual

---

## 1. Descripción del proyecto

Eco nació de una observación simple: la mayoría de las herramientas musicales digitales asumen que quien las usa puede ver la pantalla. Para un músico ciego o con baja visión, eso significa que un afinador de guitarra, una app de partituras o un identificador de pedales son básicamente inutilizables. Eco intenta resolver eso.

El sistema cubre cuatro funciones: afinar un instrumento con feedback hablado, leer partituras mediante reconocimiento óptico, identificar pedales de efectos usando la cámara, y personalizar la experiencia visual y auditiva. Todo operado por voz, teclado o lector de pantalla.

Está construido sobre Next.js 15, TypeScript y Tailwind CSS. Para las funciones de cámara, voz y audio se usan las APIs nativas del navegador — MediaDevices, Web Speech API y AudioContext — sin librerías externas.

---

## 2. Estado de la versión inicial

| Pantalla | Estado |
|---|---|
| Ajustes (`/ajustes`) | ✅ Completo |
| Detectar pedal (`/pedal`) | ✅ Completo (detección mock) |
| Leer partitura (`/partitura`) | 🚧 UI e integración backend implementadas — OCR sin validar en producción |
| Afinador (`/afinador`) | 🚧 Estructura definida, lógica pendiente |
| Metrónomo (`/partitura/metronomo`) | 🚧 Estructura definida, lógica pendiente |

---

## 3. Decisiones de accesibilidad

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

**Anti-flash de tema.** Al cargar la app, existe un instante donde JavaScript todavía no corrió y el tema guardado no está aplicado. Para evitar ese flash visual, se ejecuta un script síncrono en el `<head>` que lee las preferencias de `localStorage` y aplica los atributos al `<html>` antes del primer render.

---

## 4. Implementación técnica de accesibilidad

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

| Tema | Ratio texto/fondo |
|---|---|
| Claro | ~7:1 |
| Oscuro | ~18:1 |
| Alto contraste claro | 21:1 |
| Alto contraste oscuro | 21:1 |

### Tipografía

El default es Atkinson Hyperlegible, diseñada por el Braille Institute para usuarios con baja visión. Sus formas abiertas y la alta diferenciación entre caracteres similares (1/l/I, 0/O) reducen la ambigüedad especialmente en partituras y nombres de acordes.

---

## 5. Evaluación

### WAVE — pantalla `/pedal`

Se evaluó la pantalla de detección de pedal con WAVE (Web Accessibility Evaluation Tool). Es la pantalla más compleja del sistema en términos de accesibilidad, ya que combina video en vivo, detección con feedback hablado y estado dinámico.

**Resultado: AIM Score 10/10. 0 errores, 0 errores de contraste.**

| Categoría | Resultado |
|---|---|
| Errors | 0 |
| Contrast Errors | 0 |
| Alerts | 1 |
| Features | 1 |
| Structure | 5 |
| ARIA | 11 |

La única alerta corresponde al elemento `<video>` sin subtítulos (`<track>`), lo cual es técnicamente correcto según WCAG pero no aplica en este contexto: el video es un stream de cámara en vivo, no contenido multimedia con audio. No se agrega una pista de subtítulos porque no hay audio que transcribir.

### Criterios WCAG 2.2 verificados manualmente

| Criterio | Descripción | Resultado |
|---|---|---|
| 1.1.1 | Contenido no textual | ✅ Íconos decorativos marcados `aria-hidden` |
| 1.3.1 | Información y relaciones | ✅ `dl`, `nav`, `main`, `header` correctamente usados |
| 1.3.3 | Características sensoriales | ✅ Estado del LED y nav activa usan texto además de color |
| 1.4.3 | Contraste mínimo | ✅ Cumple AA en todos los temas |
| 2.1.1 | Teclado | ✅ Navegación completa sin mouse |
| 2.4.1 | Evitar bloques | ✅ Skip link en todas las páginas |
| 2.4.2 | Página con título | ✅ Title único en cada ruta |
| 2.4.7 | Foco visible | ✅ Outline visible en todos los elementos focusables |
| 3.1.1 | Idioma de la página | ✅ `lang="es"` en `<html>` |
| 4.1.2 | Nombre, función, valor | ✅ Roles y estados ARIA correctos |

### Prueba con TalkBack (Android)

Se probó en dispositivo Android con Brave, accediendo vía HTTPS:

1. Al ingresar, TalkBack anuncia el título de la página
2. La cámara se inicializa → TTS dice "Cámara lista. Presioná el botón Detectar pedal..."
3. Swipe derecho → TalkBack anuncia "Detectar pedal, botón"
4. Doble toque → TTS narra el resultado completo del pedal

Todo el flujo es operable sin exploración visual de la pantalla.

> El acceso a cámara requiere HTTPS. En red local el navegador bloquea `navigator.mediaDevices` por política de seguridad. El deployment usa Cloudflare Tunnel para exponer el servidor con HTTPS.

---

## 6. Conclusiones

La versión inicial demuestra que es posible construir herramientas musicales que funcionen igual de bien para un usuario ciego que para uno con visión. La pantalla de pedal es el ejemplo más claro: guía al usuario a través de una tarea de visión — apuntar la cámara a un objeto físico — sin requerir ninguna exploración visual, y obtiene la máxima puntuación en la evaluación de accesibilidad.

Lo que está pendiente son las funcionalidades centrales del Afinador y el Metrónomo, y la validación del reconocimiento OCR de partituras en el entorno de producción. La base técnica y de accesibilidad para esas pantallas ya está definida.

Una cosa que quedó clara durante el desarrollo es que diseñar para usuarios ciegos mejora la experiencia para todos. El foco automático al botón, el TTS al inicializar la cámara, la narración de acordes en español — son soluciones que también ayudan a alguien con movilidad reducida, a alguien que está usando la app con la pantalla apagada para ahorrar batería, o simplemente a alguien que prefiere no tener que buscar con la vista cada vez que abre la app.
