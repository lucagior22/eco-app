# Informe — Eco: Asistente Musical Accesible

# Parte 1 — Investigación y evaluación de accesibilidad

---

## 1.1 Decisiones de accesibilidad

La accesibilidad no se trató como una lista de requisitos a cumplir al final, sino como el criterio principal de cada decisión de diseño. Algunos ejemplos concretos de cómo eso influyó en la implementación:

**El problema del botón invisible.** En la pantalla de pedal, el usuario tiene que apuntar la cámara a un objeto físico y después presionar un botón. Si es ciego, no sabe que la cámara ya está activa ni dónde está el botón. La solución fue combinar dos acciones automáticas al inicializar la cámara: narrar una instrucción por voz ("Cámara lista. Presioná el botón Detectar pedal...") y mover el foco del teclado directamente al botón. El usuario escucha la instrucción y puede actuar de inmediato.

```tsx
useEffect(() => {
  if (isActive) {
    onReady?.(torchSupported)  // narra la instrucción
    buttonRef.current?.focus() // lleva el foco al botón
  }
}, [isActive])
```

El parámetro `torchSupported` refleja una extensión posterior del mismo criterio: el pedal se fotografía a menudo con poca luz, y la app puede encender el flash del teléfono. Pero un usuario ciego no puede ver que ese botón existe, así que la instrucción hablada lo menciona explícitamente — y solo cuando el dispositivo realmente soporta el flash, para no ofrecer un control que no va a funcionar.

**Acordes en español para TTS.** Los nombres de acordes en notación estándar son ininteligibles para un sintetizador de voz: "Bm" se leería "bi eme", "C#maj7" no significa nada hablado. Se implementó `chordToSpanish()` que convierte cualquier acorde antes de pasarlo al narrador: "Am" → "La menor", "C#maj7" → "Do sostenido mayor séptima". Un caso especial es "Bm": sin la conversión el TTS diría "Sim", que es un homófono de "sí mismo" y genera confusión.

**Color nunca como único diferenciador.** El ítem activo en la navegación tiene `aria-current="page"` y un subrayado visible, no solo un cambio de color. En el afinador, el estado de afinación no se comunica con el verde de la aguja sino con texto explícito ("Afinado", "Un poco alto", "Un poco bajo") más una escala verbal de magnitud ("un poco", "medianamente", "muy"). En el metrónomo, el botón de reproducción cambia su etiqueta ("Iniciar metrónomo" / "Detener metrónomo") y su `aria-pressed`, no solo su color. Esto cubre tanto a usuarios con daltonismo como a quienes usan lectores de pantalla.

**Narrador como primer foco en el afinador.** La pantalla `/afinador` tiene seis botones de selección de cuerda que aparecen visualmente primero, pero en términos de orden de tabulación eso crea un problema: un usuario ciego llega a la pantalla y no puede silenciar el narrador antes de que empiece a hablar, porque el foco cae primero en las cuerdas. La solución fue reordenar el DOM para que los botones de control (Narrador y Pausar) queden antes del display del afinador, sin modificar el layout visual. Así el primer Tab del usuario llega al botón Narrador, que puede activar o desactivar antes de que el audio empiece.

**Un solo canal de audio a la vez.** El afinador hablaba dos veces en paralelo: por un lado el narrador propio de la app (Web Speech API), por otro una región `aria-live` que el lector de pantalla también vocalizaba, sin coordinación ni límite de frecuencia entre ambos. Para un usuario con VoiceOver o NVDA el resultado era eco y verborrea constante. La solución fue centralizar el texto a anunciar en un único origen y conmutar la región `aria-live` a `off` cuando el narrador de la app está activo y el navegador soporta Web Speech, dejándola en `polite` en caso contrario. Así siempre hay exactamente un canal hablando, incluso si el usuario silencia el narrador o el navegador no soporta síntesis de voz.

Este caso ilustra algo que no es evidente al diseñar: en una app pensada para lectores de pantalla, *agregar* anuncios accesibles puede empeorar la accesibilidad. La cantidad de información hablada es un recurso escaso que hay que presupuestar, no maximizar.

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
| 1.1.1    | Contenido no textual        | Íconos decorativos marcados `aria-hidden`              |
| 1.3.1    | Información y relaciones    | `dl`, `nav`, `main`, `header` correctamente usados     |
| 1.3.3    | Características sensoriales | Estado de afinación y nav activa usan texto además de color |
| 1.4.3    | Contraste mínimo            | Cumple AA en todos los temas                           |
| 2.1.1    | Teclado                     | Navegación completa sin mouse                          |
| 2.4.1    | Evitar bloques              | Skip link en todas las páginas                         |
| 2.4.2    | Página con título           | Title único en cada ruta                               |
| 2.4.7    | Foco visible                | Outline visible en todos los elementos focusables      |
| 3.1.1    | Idioma de la página         | `lang="es"` en `<html>`                                |
| 4.1.2    | Nombre, función, valor      | Roles y estados ARIA correctos                         |

---

### Sin JavaScript

Se deshabilitó JavaScript desde Chrome DevTools y se navegaron las tres pantallas principales en la versión desplegada.

| Elemento                                 | Resultado                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Navegación principal                     | Renderiza correctamente vía SSR                                       |
| Títulos y descripciones de cada pantalla | Visibles — Next.js sirve el HTML completo                             |
| Botones de ajustes                       | No responden — requieren event handlers de React                     |
| Habilitación de cámara (`/pedal`)        | Permanece en estado "Iniciando cámara" — requiere `MediaDevices API` |
| Habilitación de micrófono (`/afinador`)  | No se activa — requiere `Web Audio API`                              |

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
| Chrome    | Blink | Funciona correctamente |
| Brave     | Blink | Funciona correctamente |
| Edge      | Blink | Funciona correctamente |
| Firefox   | Gecko | Funciona correctamente |

El comportamiento es consistente en todos los navegadores probados. Las APIs utilizadas (MediaDevices, Web Audio, Web Speech) tienen soporte completo en los distintos motores modernos.

---

### Diferentes resoluciones

Se probó el layout en distintas resoluciones usando Chrome DevTools (modo responsive).

| Resolución | Dispositivo | Resultado                              |
| ---------- | ----------- | -------------------------------------- |
| 375×667    | iPhone SE   | Funcional — con excepción nota abajo |
| 390×844    | iPhone 14   | Funciona correctamente               |
| 1280×800   | Laptop      | Funciona correctamente               |
| 1920×1080  | Desktop     | Funciona correctamente               |

**Observación — fuente muy grande en pantalla pequeña:**

En iPhone SE (375px de ancho) con la fuente configurada en tamaño muy grande desde `/ajustes`, algunos elementos desbordan la pantalla. Este es el único caso de overflow detectado, y se da en la combinación del dispositivo más pequeño con la opción de fuente más grande.

---

## 1.4 Test de usabilidad con usuarios

Las validaciones de la sección anterior verifican que el código cumple los estándares. Esta sección verifica algo distinto y no deducible de lo anterior: si una persona puede efectivamente usar la app. Los resultados no coinciden, y esa discrepancia es el hallazgo más valioso del trabajo.

### Metodología

Se realizó un test de usabilidad de tipo indagación sobre el sistema en desarrollo, con moderador y protocolo de pensamiento en voz alta (*think aloud*). Participaron cinco usuarios objetivo en sesiones individuales, cada uno resolviendo las mismas siete tareas sobre la app desplegada. Las sesiones se llevaron a cabo durante la segunda y tercera semana de julio de 2026.

La muestra se compuso cruzando dos ejes independientes: la experiencia musical y la alfabetización tecnológica. Esa separación resultó determinante para interpretar los resultados, porque cada eje explica fallas de naturaleza distinta.

| Participante | Perfil                                                       | Experiencia musical                        | Experiencia tecnológica              |
| ------------ | ------------------------------------------------------------ | ------------------------------------------- | ------------------------------------- |
| Francisco    | Estudiante, 22 años                                          | Alta — usa a diario herramientas del estilo de Eco | Alta                          |
| Thiago       | Estudiante avanzado de negocios, 22 años                     | Media — tomó clases en la infancia        | Alta, con experiencia en el sector    |
| Mónica       | Profesora de música, 33 años, con discapacidad visual moderada | Alta                                      | Alta, usuaria de herramientas de accesibilidad |
| Dolores      | Estudiante, 25 años                                          | Nula                                       | Media — usuaria cotidiana, no experta |
| Fernanda     | Arquitecta, 52 años                                          | Nula                                       | Baja                                  |

Mónica es la única participante con discapacidad visual, es decir, la única que representa al usuario principal del sistema. El resto cubre el espectro de personas que acompañan o comparten el uso de una herramienta así.

### Tareas

| N.º | Consigna                                                                                          | Dimensión evaluada |
| --- | ------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Primera apertura de Eco: ingresar y afinar la 6.ª cuerda de la guitarra (bajada ~40 cents antes)   | Contenido          |
| 2   | Afinar la 4.ª cuerda de espaldas a la pantalla, guiándose solo por lo que se escucha              | Accesibilidad      |
| 3   | Fotografiar una *lead sheet* con cifrado y obtener la lista de acordes                            | Funcionalidad      |
| 4   | Repetir con una imagen sin cifrado alfabético, donde la app devuelve lista vacía                  | Feedback           |
| 5   | Poner el metrónomo a 100 BPM, activar la vibración y hacerlo sonar                                 | Funcionalidad      |
| 6   | Averiguar en qué posición están las perillas de un pedal                                           | Accesibilidad      |
| 7   | Configurar alto contraste, narrador rápido y letra muy grande, y volver a usar el afinador        | Interfaz           |

La tarea 2 es la prueba central del sistema: obliga a operar la app sin mirar la pantalla, que es la condición permanente del usuario objetivo.

### Resultados

| Tarea        | Francisco | Thiago  | Mónica  | Dolores | Fernanda | Logradas |
| ------------ | --------- | ------- | ------- | ------- | -------- | -------- |
| Tarea 1      | L 1:30    | L 2:10  | L 2:10  | L\* 3:40 | L\* 3:20 | 5 de 5   |
| Tarea 2      | L 0:40    | L 1:55  | L 1:05  | L\* 4:15 | L\* 4:10 | 5 de 5   |
| Tarea 3      | L 2:00    | L 1:15  | L\* 3:20 | L 2:25  | L\* 4:05 | 5 de 5   |
| Tarea 4      | L 1:00    | L 1:20  | L 2:35  | L\* 3:05 | L\* 4:45 | 5 de 5   |
| Tarea 5      | L 1:50    | L 3:05  | L 4:40  | L 2:20  | NL 4:30  | 4 de 5   |
| Tarea 6      | NL 4:50   | NL 5:20 | NL 5:15 | NL 5:30 | NL 6:40  | 0 de 5   |
| Tarea 7      | L 2:50    | L 1:40  | L 3:05  | L 1:45  | L\* 4:50 | 5 de 5   |
| **Total**    | **14:40** | **16:45** | **22:10** | **23:00** | **32:20** |        |

Referencias: L = logró sin ayuda; L\* = logró con ayuda del moderador; NL = no logró. El tiempo es el de ejecución de cada tarea.

Sobre 35 tareas ejecutadas (cinco participantes por siete tareas), 29 se completaron y 6 fallaron. De las completadas, 20 fueron sin ayuda del moderador y 9 requirieron intervención. La tarea 6, detección de perillas, es la única que falló para la totalidad de los participantes y concentra a la vez el mayor tiempo promedio del estudio.

Los tiempos totales por sesión van de 14:40 a 32:20. Esa dispersión responde al nivel de alfabetización tecnológica de cada participante y no a la presencia de discapacidad: **Mónica, única participante con discapacidad visual, completó la sesión más rápido que dos participantes videntes.** Es la confirmación más directa de la premisa del proyecto — el diseño accesible no es una versión degradada del producto.

### Hallazgos

**El silencio de la app es ambiguo.** Eco narra los resultados positivos pero no avisa cuando está procesando, cuando no encuentra nada o cuando algo falla. En la tarea 4, cuatro de cinco participantes se quedaron esperando una respuesta hablada que nunca llegó, y dos repitieron la foto creyendo que la app se había colgado. Fernanda esperó casi dos minutos en silencio. Mónica lo formuló como principio: *"El resultado negativo también es un resultado, tiene que decirlo en voz alta igual que cuando encuentra algo"*.

El diagnóstico posterior confirmó la causa: el patrón de canal único descrito en §1.1 se implementó en `/afinador` y `/pedal`, pero en `/partitura` los estados de proceso quedaron viajando únicamente por la región `aria-live`. Para quien usa un lector de pantalla eso alcanza; para los cinco participantes del test, que no lo usaban, la pantalla era muda. La accesibilidad correctamente etiquetada no sustituye al feedback audible propio.

**El menú no coincide con lo que el usuario busca.** El metrónomo está dentro de Partitura, la vibración dentro de Ajustes y el contraste dentro de un control llamado "Color". Los cinco participantes tropezaron con las tres. Thiago recorrió la barra inferior, después Ajustes y recién tercero entró a Partitura: *"estaba el botón Ir al metrónomo, no lo hubiera buscado ahí nunca"*. Mónica y Dolores buscaron literalmente la palabra "contraste" en Ajustes y no la encontraron, porque el control se llama "Color".

**Solo los músicos detectan los errores.** Francisco y Mónica notaron que el afinador anunciaba "afinado" con la cuerda todavía levemente baja, y que faltaban acordes en el resultado del OCR. Los otros tres dieron esos mismos resultados por correctos, sin forma de evaluarlos. Dolores lo dijo explícitamente: *"Yo no sé si están todos, la verdad. Para mí está bien porque me los mostró"*.

Este hallazgo extiende el principio ya enunciado en §2.3 sobre la detección de pedal. No basta con que el sistema no mienta: cuando el usuario no puede verificar el resultado —sea porque no ve, sea porque no sabe de música— la interfaz tiene que comunicar su propio grado de certeza. Un resultado presentado con más seguridad de la que tiene es un error de accesibilidad, no de precisión.

**La detección de perillas no funciona.** Falló para los cinco participantes, incluido el músico experto, con el mayor tiempo promedio del estudio. Los intentos fueron entre cuatro y seis por persona, variando distancia, ángulo e iluminación. Dos elementos del diseño sí funcionaron: las instrucciones habladas resultaron claras para todos, y la abstención explícita fue valorada por la usuaria con discapacidad visual — Mónica: *"Al menos avisa cuando no está seguro, eso está bien"*.

Pero apareció un costo no previsto de la formulación actual del mensaje de fallo. Dolores concluyó *"no sé si estoy haciendo algo mal yo"* y Fernanda *"debo tener el pulso muy tembloroso"*: ninguna de las dos tenía responsabilidad en la falla, y ambas la atribuyeron a su propia técnica. Un mensaje de error que no aclara de quién es la falla la traslada al usuario por defecto.

### Correcciones derivadas

El test produjo el siguiente plan de trabajo, ordenado por impacto observado. Los cambios están pendientes de implementación al momento de escribir esta sección.

| Área | Corrección | Evidencia |
| --- | --- | --- |
| Narrador | Retener la primera locución hasta que haya un gesto del usuario, en lugar de perderla | 3 de 5 creyeron que el narrador estaba roto |
| Narrador | Narrar en `/partitura` los estados de proceso, el resultado vacío y los errores, no solo los positivos | 4 de 5 esperaron una voz que nunca llegó |
| Bienvenida | Narrar el diálogo inicial y acortar su texto visible | Mónica: *"si fuera ciega esto no lo pasaba"* |
| Bienvenida | Restituir el indicador de foco del diálogo | Regla de foco visible de `CLAUDE.md` |
| Navegación | Mover el metrónomo a pantalla independiente con ícono propio en la barra | 5 de 5 lo buscaron ahí |
| Ajustes | Renombrar el control "Color" para que incluya la palabra contraste | 5 de 5 buscaron "contraste" |
| Metrónomo | Duplicar el control de vibración dentro de la pantalla del metrónomo | 5 de 5 lo buscaron ahí; Fernanda abandonó la tarea |
| Metrónomo | Anunciar el BPM con retardo, para que un ajuste largo produzca un anuncio y no veinte | Mónica: *"veinte anuncios para bajar veinte pulsos"* |
| Metrónomo | Comunicar que la pulsación sostenida acelera el ajuste | Fernanda presionó veinte veces sin descubrirla |
| Metrónomo | Aumentar la duración del pulso háptico y diferenciar el acento por patrón | Francisco y Mónica, por separado |
| Afinador | Corregir la numeración de cuerdas, invertida respecto de la convención estándar | 2 participantes necesitaron ayuda para identificar la cuerda |
| Afinador | Incluir la cuerda en la locución, no solo la nota | Thiago: *"no sé si me lo dijo de la cuerda que toqué o de otra"* |
| Afinador | Estrechar el umbral de "afinado" y afinar la escala verbal cerca del punto justo | Los dos participantes con oído entrenado |
| Afinador | Corregir el desborde de la fila de cuerdas con fuente muy grande | Fernanda; coincide con la observación de §1.3 |
| Partitura | Narrar la lista de acordes al terminar el análisis, sin requerir presionar un botón | Francisco: *"lo tuve que leer"* |
| Partitura | Enunciar el resultado del OCR como lectura aproximada | Los tres participantes sin formación musical |
| Partitura | Dar jerarquía a "Tomar foto" sobre "Subir archivo", hoy de igual peso | Fernanda: *"uno debería ser el principal"*; Francisco perdió tiempo buscando el archivo |
| Pedal | Reformular el mensaje de fallo para que no atribuya la falla al usuario | Dolores y Fernanda |

La precisión de la detección de perillas queda fuera de este plan: es trabajo de algoritmo y no de interfaz, y se aborda por separado (§2.3).

Al 16 de agosto de 2026 están implementadas las tres correcciones del narrador y del metrónomo que compartían causa: la retención de la locución hasta el primer gesto, la narración de los estados de proceso, el resultado vacío y los errores en `/partitura`, y el anuncio del BPM al soltar el botón en lugar de uno por pulso. La auditoría que siguió mostró que el defecto de `/partitura` se repetía en el metrónomo, en los ajustes y en los mensajes de error de cámara y micrófono, todos anunciados por un solo canal; las cuatro pantallas usan ahora el mismo patrón de narración (ver `DECISIONS.md`, entrada del 2026-08-16). El resto de las correcciones de la tabla se fue completando después, según se detalla más abajo.

También están implementadas las cuatro correcciones del afinador. La numeración de cuerdas se invirtió para coincidir con la convención estándar y el número pasó a ser visible en la pastilla —antes existía solo en el `aria-label`—, la locución incluye ahora la cuerda además de la nota en los dos modos, el umbral de "afinado" bajó de ±10 a ±5 cents, y la fila de cuerdas admite dos filas en vez de recortarse con la fuente en tamaño muy grande. Las cuatro compartían un mismo defecto de fondo: la escala verbal de tres escalones no permitía anticipar cuánto girar la clavija, porque el más fino cubría de 5 a 25 cents y no cambiaba durante todo el trayecto. Se reemplazó por una de cinco, cuyo escalón nuevo —"casi afinada"— avisa que se está llegando: tres participantes se habían pasado de largo girando la clavija. Acompaña un hallazgo de la evaluación heurística previa: el rótulo "Escuchando…" significaba a la vez "todavía no te oí" y "dejé de oírte", y se separó en "Tocá una cuerda" y "Sin señal".

Están implementadas también las tres correcciones de `/partitura`, y con ellas apareció el hallazgo más instructivo de esta ronda. Las tres eran de interfaz —narrar la lista al terminar, enunciar el resultado como aproximado, dar jerarquía a "Tomar foto"—, pero revisar el código en busca de dónde aplicarlas expuso una causa anterior que ningún participante podía haber nombrado: la pantalla pedía la cámara sin especificar resolución. Sin ese constraint el navegador entrega un stream de unos 640×480, y ese frame iba tal cual al OCR. Una hoja A4 a esa resolución deja cada letra del cifrado en 6-8 px de alto, contra los 20-30 px que Tesseract necesita para reconocer un glifo. **El camino de foto no podía funcionar**, y ninguna mejora de narración lo habría cambiado.

Eso reencuadra la evidencia del test. Fernanda sacando cuatro fotos y esperando casi dos minutos, y Dolores repitiendo la foto dos veces porque creía que la app se había colgado, se habían registrado como falta de feedback durante el proceso. El feedback faltaba, y se agregó —texto de inicio explícito, recordatorio a los diez segundos y un corte del lado del cliente en lugar de silencio indefinido—, pero ese diagnóstico habría dejado intacto el motivo por el que las fotos no daban resultado. `/pedal` ya había resuelto exactamente este problema y lo tenía comentado en su hook de cámara; `/partitura` tiene su propia llamada a `getUserMedia` y nunca recibió el arreglo. La lección de proceso es que un hallazgo de usabilidad describe el síntoma con precisión y la causa solo por conjetura: cuando el usuario dice "esperé y no pasó nada", lo que hay que verificar es qué recibió el algoritmo, no solo qué escuchó el usuario.

Sobre las dos correcciones de presentación: la lista se narra ahora sola al terminar, con los primeros tres acordes y un cierre de "y N acordes más". No se narra completa —que era la formulación literal del hallazgo— porque una progresión puede tener decenas de acordes y una locución larga no se puede interrumpir salvo saliendo de la pantalla; el botón "Narrar acordes" deja de ser el único acceso al resultado y pasa a ser la repetición completa a pedido. El aviso de lectura aproximada acompaña tanto la locución como el texto en pantalla, y responde al principio que formuló Mónica a propósito del pedal: *"al menos avisa cuando no está seguro"*.

Ese aviso es, por ahora, fijo y no proporcional a la calidad de la lectura, y vale explicar por qué. Se evaluó propagar la confianza por palabra que Tesseract ya calcula y que el endpoint hoy usa como umbral y descarta. Se descartó por dos razones. La primera es que la confianza no cubre el caso que motivó el hallazgo: los participantes dieron por completa una lista a la que le faltaban acordes, y un acorde que el OCR nunca detectó no tiene confianza baja que reportar — no aparece. La segunda es metodológica: los valores de referencia se midieron sobre una hoja sintética, y el cambio de resolución de captura mueve esa distribución por completo, de modo que calibrar un umbral ahora sería calibrarlo contra datos que el mismo cambio invalida. Queda como trabajo posterior, con mediciones propias sobre fotos reales.

Estrechar el umbral de "afinado" obligó a una segunda intervención, esta vez sobre la precisión del detector. La lectura saltaba entre "muy baja" y "afinada" sin que nadie tocara el instrumento, lo que sugería un sesgo del algoritmo hacia frecuencias bajas. Se lo midió contra señales sintéticas de frecuencia exacta conocida en lugar de suponerlo, y el resultado descartó la hipótesis: el detector lee **+0,7 cents**, es decir ligeramente alto, y ese desvío proviene íntegramente de la inarmonicidad física de una cuerda real, no del algoritmo. La causa era otra y estaba en el código propio: el modo de cuerda fija usaba la lectura cruda de cada frame, sin el filtro de mediana ni el suavizado exponencial que sí aplicaba el modo automático, de modo que un único frame erróneo llegaba directo a la locución. Sí existe una asimetría en el algoritmo —al buscar el mínimo de la función de diferencia solo avanza hacia períodos más largos, nunca retrocede— que explica por qué el error, cuando ocurre, cae del lado grave. Las correcciones fueron unificar el suavizado en ambos modos, duplicar el tamaño del frame de análisis con un intervalo de detección que compensa el costo de cómputo, y una ventana de seguimiento adaptativa: ancha para enganchar una cuerda muy floja, angosta para descartar lecturas espurias una vez enganchada. Medido sobre las seis cuerdas con las vecinas sonando por simpatía, la app pasó de afirmar "afinada" sin estarlo en 73 lecturas a no hacerlo ninguna vez, y los saltos de escalón bajaron de 29 a 1. El detalle técnico y las mediciones están en `claude-docs/AFINADOR.md`.

Dos ajustes surgieron de probar la versión corregida. El verbo de acción "tensá" o "aflojá" al final de la locución se retiró: resultaba molesto en uso continuado y el dato accionable ya estaba en "baja" o "alta". Y el nombre de la cuerda dejó de repetirse en cada frase para decirse solo cuando la cuerda cambia. Que la cuerda apareciera era un hallazgo del test, pero nombrarla cada vez estorbaba la tarea: quien gira la clavija ya sabe en qué cuerda está, y con la voz como único canal cada palabra de más es tiempo en que no se puede escuchar el instrumento —el análisis se detiene mientras la app habla—. La secuencia al afinar quedó "Afinando cuerda 6, Mi", y luego "Muy baja", "Bastante baja", "Un poco baja", "Casi afinada, un poco baja", "Afinada". El nombre vuelve al cambiar de cuerda o tras un silencio.

---

# Parte 2 — Desarrollo

---

## 2.1 Descripción del proyecto

Eco nació de una observación simple: la mayoría de las herramientas musicales digitales asumen que quien las usa puede ver la pantalla. Para un músico ciego o con baja visión, eso significa que un afinador de guitarra, una app de partituras o un identificador de pedales son básicamente inutilizables. Eco intenta resolver eso.

El sistema cubre cinco funciones: afinar un instrumento con feedback hablado, leer el cifrado de acordes de una partitura, marcar el tempo con un metrónomo audible y háptico, leer la posición de las perillas de un pedal de efectos con la cámara, y personalizar la experiencia visual y auditiva. Todo operado por teclado o lector de pantalla.

Está construido sobre Next.js 15, TypeScript y Tailwind CSS. Para las funciones de cámara, voz y audio se usan las APIs nativas del navegador sin librerías externas. Las dos funciones que requieren visión por computadora corren en el servidor, dentro del mismo contenedor: el OCR del cifrado con Tesseract y la detección de perillas con OpenCV, ambos invocados como procesos desde rutas de API.

---

## 2.2 Estado actual del sistema

Las cinco pantallas están implementadas y operativas. La distinción relevante no es entre "hecho" y "pendiente", sino entre las funciones cuya precisión ya es confiable y las dos que dependen de visión por computadora, donde el comportamiento es correcto pero la exactitud todavía es irregular.

| Pantalla                           | Estado             | Detalle                                                                                                                              |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Ajustes (`/ajustes`)               | Completo           | Cinco preferencias persistidas en `localStorage`: tema (4 variantes), tamaño de fuente, familia tipográfica, velocidad del narrador y vibración. |
| Afinador (`/afinador`)             | Completo           | Detección de pitch con algoritmo YIN sobre Web Audio. Modo automático y modo cuerda por cuerda, histéresis en el umbral de afinado y narración por un canal único. |
| Metrónomo (`/metronomo`)           | Completo           | Rango de 40 a 220 BPM, pulso por audio y por vibración, con acento en el primer tiempo del compás. Control de vibración en la propia pantalla, además del de Ajustes. |
| Leer partitura (`/partitura`)      | Funcional, precisión irregular | OCR del cifrado de acordes con Tesseract. Devuelve acordes reales sobre lead sheets, pero confunde algunos y omite otros; el resultado se narra solo y se enuncia siempre como lectura aproximada. |
| Detectar pedal (`/pedal`)          | Funcional, precisión parcial | Detección real de perillas por visión (OpenCV), no simulada. Vota entre 5 capturas y reporta la posición de cada perilla como hora de reloj, o declara explícitamente que no pudo leerla. |

---

## 2.3 Limitaciones conocidas

Documentar dónde el sistema todavía falla es parte del resultado. Las dos funciones basadas en visión por computadora comparten el mismo patrón: la interfaz y la accesibilidad están resueltas, pero el algoritmo que las alimenta no alcanza aún una precisión confiable.

**Lectura de partitura.** El reconocimiento funciona sobre cifrado alfabético impreso —lead sheets, cancioneros, real books—, que es el formato que efectivamente usa un guitarrista. Sobre una hoja de prueba controlada detecta los 16 acordes en orden, incluyendo alteraciones, bajo invertido y tensiones. Sobre partituras reales, en cambio, confunde algunos acordes y saltea otros. Una partitura sin cifrado, donde la armonía está implícita en las notas, no devuelve nada: reconocer eso exigiría análisis armónico además de OCR.

Una parte de esa irregularidad no era del OCR sino de lo que se le entregaba: hasta la corrección descrita en §1.4, la cámara de la pantalla pedía el stream sin especificar resolución y el navegador devolvía unos 640×480, insuficiente para que las letras del cifrado superaran el tamaño mínimo de glifo que Tesseract necesita. Corregido eso, queda pendiente medir cuánta de la imprecisión restante es atribuible al reconocimiento en sí. La comparación honesta exige rehacer las pruebas con fotos reales a la resolución nueva.

Vale registrar que la implementación original de esta pantalla no podía funcionar en absoluto. Usaba oemer, una herramienta de OMR (*Optical Music Recognition*) que reconoce notas, claves y silencios pero que, según su propia documentación, no reconoce cifrado, letra ni texto. El código buscaba elementos `<harmony>` en su salida, que oemer nunca emite. El diagnóstico fue que la tarea estaba mal encuadrada: en una partitura los acordes están impresos como **texto** sobre el pentagrama, así que detectarlos es reconocimiento de texto (OCR), no de notación musical (OMR). El cambio a Tesseract con un alfabeto restringido al cifrado corrigió el encuadre.

**Detección de perillas.** Esta pantalla se rehízo a partir de un diagnóstico medido sobre las 92 fotografías reales de un mismo pedal tomadas durante el desarrollo. Como el pedal estaba quieto entre disparos, la consistencia de las lecturas sirve como medida objetiva de calidad.

El diagnóstico encontró tres defectos concretos, no un problema difuso de calibración. El más grave: la banda donde se buscaba la marca indicadora era **absoluta** (30 a 115 píxeles) mientras que los radios reales de las perillas iban de 45 a 110. La banda excedía el radio de la propia perilla en las 280 detecciones, de modo que el algoritmo no medía la marca sino la dirección de lo más brillante alrededor: la serigrafía blanca del panel, el cuerpo del pedal y hasta la mesa de madera del fondo. El síntoma delator estaba a la vista en los datos: los puntajes de contraste iban de 87 a 229 contra un umbral de 15 que nunca rechazaba nada. Los otros dos defectos eran puntuar por brillo absoluto —que no distingue una marca fina de un reflejo ancho sobre plástico brillante— y un umbral de fusión de detecciones tan grande que colapsaba perillas vecinas en una sola.

Corregidos los tres, la consistencia de lectura subió del 59 % al 67 % y las detecciones correctas de las cuatro perillas del 46 % al 58 %. Pero eso sigue siendo un techo: **fotografiando el pedal quieto, la misma perilla todavía puede leerse distinto entre tomas consecutivas.**

El cambio de fondo fue entonces otro. En lugar de seguir persiguiendo precisión, se atacó la honestidad de la respuesta: al presionar el botón se toma una **ráfaga de cinco capturas** separadas 400 milisegundos, y una perilla se reporta solo si al menos tres coinciden. Cuando no hay acuerdo, el sistema dice explícitamente **"no pude leerla con confianza"**. Medido sobre las mismas fotos, esto cambia el comportamiento de "acertar el 68 % y equivocarse con total seguridad el 32 % restante" a "responder en el 80 % de las perillas y acertar el 93 % de esas veces".

La razón de ese diseño es de accesibilidad antes que de precisión: **un usuario ciego no puede verificar el resultado**. Alguien que ve descarta una lectura absurda de un vistazo; quien no ve, no. Bajar la cobertura al 80 % a cambio de no afirmar lo que no se sabe es, para este usuario, una mejora y no una pérdida.

Por el mismo criterio se cambiaron las etiquetas. Antes eran índices ("Perilla 1", "Perilla 2"); como la cantidad detectada variaba entre fotos, "Perilla 2" pasaba a referirse a otra perilla física sin que el usuario tuviera forma de notarlo. Ahora se nombra la posición en el panel ("Arriba izquierda"), que sí es una identidad estable.

Queda abierto un sesgo sistemático por perspectiva: la cara superior de la perilla se ve como una elipse y no como un círculo, lo que corre el ángulo medido. La votación no lo corrige porque no es ruido aleatorio. Corregirlo exigiría estimar el plano del pedal y rectificar la perspectiva.

---

## 2.4 Conclusiones

El proyecto demuestra que es posible construir herramientas musicales que funcionen igual de bien para un usuario ciego que para uno con visión. El afinador es el ejemplo más claro: convierte una tarea puramente visual —mirar una aguja acercarse al centro— en una secuencia hablada que incluye la nota, la dirección del error y una estimación verbal de su magnitud, lo que permite afinar sin ver la pantalla en ningún momento. El test de usabilidad confirmó que el flujo funciona —los cinco participantes afinaron de espaldas a la pantalla— y a la vez que esa escala verbal es todavía demasiado gruesa cerca del punto justo (§1.4). La pantalla de pedal aplica el mismo criterio a una tarea de visión física: guía al usuario a apuntar la cámara a un objeto sin requerir exploración visual, y obtiene la máxima puntuación en la evaluación de accesibilidad.

Lo que queda pendiente no es la construcción de las pantallas, que están todas operativas, sino la precisión de las dos funciones basadas en visión por computadora. Ese trabajo es de algoritmo, no de interfaz: la capa de accesibilidad que las envuelve ya está resuelta y no cambia si mejora el reconocimiento.

Dos aprendizajes quedaron claros durante el desarrollo. El primero es que diseñar para usuarios ciegos mejora la experiencia para todos: el foco automático al botón, el TTS al inicializar la cámara, la narración de acordes en español son soluciones que también ayudan a alguien con movilidad reducida, o simplemente a quien prefiere no buscar con la vista cada vez que abre la app.

El segundo es más incómodo y apareció en las dos funciones que fallan. Para un usuario que no puede ver, la confiabilidad **es** accesibilidad: una interfaz impecablemente etiquetada que dice el dato equivocado no es accesible, porque le quita a esa persona la posibilidad de detectar el error que cualquier otra corregiría con una mirada.

Ese principio se aplicó concretamente en la detección de pedal, y cambió el criterio de diseño. La pregunta dejó de ser "cómo hago el algoritmo más preciso" y pasó a ser "cómo hago que el algoritmo admita cuándo no sabe": votar entre varias capturas y callarse cuando no hay acuerdo. El resultado responde menos veces que antes —el 80 % en lugar del 100 %— y sin embargo es mejor, porque el 100 % anterior incluía un 32 % de afirmaciones equivocadas que el usuario no tenía cómo detectar. El mismo criterio se llevó después a la lectura de partitura, aunque en una forma más débil: ahí el resultado se enuncia siempre como aproximado, en la voz y en la pantalla, en lugar de presentarse con la seguridad que no tiene. Es más débil porque el aviso es fijo y no distingue una lectura buena de una mala, mientras que el pedal calla exactamente las perillas sobre las que no hay acuerdo. Llevarlo hasta ese punto exige una medición que todavía no está hecha, y hacerla antes de corregir la resolución de captura habría sido calibrar contra datos por vencer.

Queda como el trabajo pendiente más claro, y con una precisión que el propio proceso aportó: en partitura el criterio choca con un límite que el pedal no tiene. La confianza del OCR puede señalar un acorde mal leído, pero no uno que nunca se leyó, y la queja de fondo de los participantes —*"yo no sé si están todos"*— es sobre lo ausente. Admitir cuándo no se sabe es más fácil cuando se sabe qué se está mirando; en una partitura, parte de lo que falta nunca entró al campo de visión del algoritmo.
