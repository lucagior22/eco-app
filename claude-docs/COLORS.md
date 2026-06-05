# Sistema de colores — eco-app

Tokens definidos en `app/globals.css`. Cuatro temas: `light`, `dark`, `hc-light`, `hc-dark`.

Fuente original: prototipo Figma (archivo `AebURRhSh0VGRnlkDrApKA`). Los valores ajustados se desvían del Figma para cumplir WCAG AA.

---

## Paleta por tema

### light (default)

| Token | Valor | Contraste sobre bg | Uso |
|---|---|---|---|
| `--color-bg` | `#f8f9fa` | — | Fondo general |
| `--color-surface` | `#ffffff` | — | Cards, nav |
| `--color-text-primary` | `#212529` | 15:1 ✅ | Texto principal |
| `--color-text-secondary` | `#6b7280` | 4.6:1 ✅ | Subtítulos, labels |
| `--color-accent` | `#4361ee` | 4.7:1 ✅ | Nav activo, botones primarios |
| `--color-success` | `#15803d` | 4.8:1 ✅ | Estado afinado, confirmaciones |
| `--color-error` | `#bf360c` | 5.3:1 ✅ | Estado desafinado, errores |
| `--color-focus` | `#4361ee` | 4.7:1 ✅ | Outline de foco (:focus-visible) |
| `--color-border` | `#ced4da` | — | Bordes decorativos |
| `--color-header-bg` | `#e9ecef` | — | Fondo del PageHeader |

### dark

| Token | Valor | Contraste sobre bg | Uso |
|---|---|---|---|
| `--color-bg` | `#121212` | — | |
| `--color-surface` | `#242424` | — | |
| `--color-text-primary` | `#f5f5f5` | 17.4:1 ✅ | |
| `--color-text-secondary` | `#a0a0a0` | 7.3:1 ✅ | |
| `--color-accent` | `#7b8ff5` | 6.3:1 ✅ | Azul claro para fondos oscuros |
| `--color-success` | `#00e676` | 11.4:1 ✅ | Figma dark accent |
| `--color-error` | `#ff6b4a` | 6.8:1 ✅ | Naranja claro para fondos oscuros |
| `--color-focus` | `#ffea00` | 17.6:1 ✅ | Amarillo — Figma resaltador/foco |
| `--color-border` | `#3a3a3a` | — | |
| `--color-header-bg` | `#1a1a1a` | — | |

### hc-light

| Token | Valor | Contraste sobre bg | Uso |
|---|---|---|---|
| `--color-bg` | `#ffffff` | — | |
| `--color-surface` | `#ffffff` | — | |
| `--color-text-primary` | `#000000` | 21:1 ✅ | |
| `--color-text-secondary` | `#404040` | 10.4:1 ✅ | |
| `--color-accent` | `#0000cc` | 11.2:1 ✅ | Figma HC: #0000ee, oscurecido levemente |
| `--color-success` | `#005a00` | 8.5:1 ✅ | Figma HC |
| `--color-error` | `#c50000` | 6.2:1 ✅ | Figma HC |
| `--color-focus` | `#0000cc` | 11.2:1 ✅ | = accent |
| `--color-border` | `#000000` | — | |
| `--color-header-bg` | `#f0f0f0` | — | |

### hc-dark

| Token | Valor | Contraste sobre bg | Uso |
|---|---|---|---|
| `--color-bg` | `#000000` | — | |
| `--color-surface` | `#0a0a0a` | — | |
| `--color-text-primary` | `#ffffff` | 21:1 ✅ | |
| `--color-text-secondary` | `#cccccc` | 17:1 ✅ | |
| `--color-accent` | `#00ff00` | 15.3:1 ✅ | Figma HC dark |
| `--color-success` | `#00ff00` | 15.3:1 ✅ | = accent |
| `--color-error` | `#ff00ff` | 6.7:1 ✅ | Magenta — distinguible del verde sin depender de rojo/verde |
| `--color-focus` | `#ffff00` | 19.6:1 ✅ | Figma HC dark |
| `--color-border` | `#ffffff` | — | |
| `--color-header-bg` | `#0d0d0d` | — | |

---

## Decisiones de ajuste respecto al Figma

### Verde de éxito (light): `#2ecc71` → `#15803d`

El Figma usa `#2ecc71` como color de acierto. Sobre `#f8f9fa` da 2:1 de contraste — falla WCAG AA para texto normal (4.5:1) y texto grande (3:1). `#15803d` da 4.8:1 y mantiene la identidad verde.

### Rojo de error (light): `#ff3d00` → `#bf360c`

El Figma usa `#ff3d00`. Da 3.4:1 — pasa para UI y texto grande (≥18px), pero falla para texto normal. `#bf360c` da 5.3:1 y cubre todos los usos.

### Acento en dark: `#4361ee` → `#7b8ff5`

`#4361ee` sobre `#121212` da solo 3.8:1 — pasa para UI pero no para texto. Se usa una variante más clara del mismo azul índigo.

### Foco en dark: `#4361ee` → `#ffea00`

Amarillo de alta luminosidad, específicamente diseñado para foco visible sobre fondos oscuros. 17.6:1 de contraste.

### Error en hc-dark: magenta `#ff00ff`

Evita la combinación rojo/verde (problemática para daltónicos del tipo deuteranopía/protanopía). Magenta es distinguible del verde brillante `#00ff00` incluso con daltonismo rojo-verde porque tiene componente azul.

---

## Reglas de uso

- `--color-success` y `--color-error` pueden usarse como texto solo si el tamaño ≥ 14px bold o ≥ 18px regular. Para texto más chico, usar `--color-text-primary` con ícono o etiqueta de estado.
- `--color-border` es decorativo. Para bordes de componentes interactivos (inputs, botones outline) usar `--color-text-secondary` como mínimo.
- `prefers-reduced-motion: reduce` está implementado en globals.css — todas las animaciones y transiciones se desactivan automáticamente.

---

## Pendiente

- Wiring de `hc-dark` en `SettingsContext` y la UI de Ajustes (actualmente solo se activa vía `data-theme="hc-dark"` en el HTML).
- Fuente Atkinson Hyperlegible: el Figma la especifica; no implementada todavía (ver DECISIONS.md si se decide adoptar).
