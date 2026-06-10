# Validaciones manuales — Informe de accesibilidad

Checklist de validaciones requeridas por el enunciado del TFI. Cada sección debe completarse y sus resultados deben volcarse en `INFORME.md` (Parte 1 — sección Evaluación).

---

## 1. Validador HTML W3C

**Herramienta:** validator.w3.org

**Pasos:**
1. Andá a **validator.w3.org** → pestaña "Validate by URI"
2. Ingresá la URL de Vercel para cada pantalla (ej. `https://tu-app.vercel.app/pedal`)
3. "Check" → capturá pantalla del resultado
4. Repetí para `/pedal`, `/ajustes`, `/partitura`

> Usar URI es el método correcto: evita artefactos de copiado y refleja el HTML real servido.

**Estado:** ✅ Completo — 0 errores, 0 warnings por URI. Ver INFORME.md sección 5.

---

## 2. Validador CSS W3C

**Herramienta:** jigsaw.w3.org/css-validator

**Pasos:**
1. Andá a **jigsaw.w3.org/css-validator** → pestaña "By URI"
2. Ingresá la URL de Vercel (ej. `https://tu-app.vercel.app/pedal`)
3. "Check" → capturá pantalla del resultado

**Estado:** ✅ Completo — 32 errores y 140 warnings, todos del CSS generado por Tailwind v4 (no del código de la app). Ver INFORME.md sección 5.

---

## 3. Sin JavaScript

**Herramienta:** Chrome DevTools

**Pasos:**
1. F12 → ⚙️ Settings (esquina superior derecha del panel DevTools)
2. Tildá "Disable JavaScript"
3. Recargá la página
4. Navegá `/pedal`, `/ajustes`, `/partitura`
5. Verificá que el contenido sea legible y estructurado (Next.js SSR debe mantenerlo)
6. Capturá pantallas de cada una

**Estado:** ✅ Completo — navegación y estructura SSR correctas; funcionalidades de browser (cámara, mic, ajustes) requieren JS. Ver INFORME.md sección 5.

---

## 4. Sin CSS

**Herramienta:** Chrome DevTools o extensión Web Developer

**Pasos (extensión Web Developer):**
1. Instalá la extensión [Web Developer](https://chrispederick.com/work/web-developer/) en Chrome/Firefox
2. CSS → "Disable All Styles"
3. Navegá `/pedal`, `/ajustes`, `/partitura`
4. Verificá que el contenido tenga orden lógico y sea legible sin estilos
5. Capturá pantallas

**Pasos alternativos (DevTools):**
1. F12 → Elements → buscá `<link rel="stylesheet">` en el `<head>`
2. Seleccioná el nodo → Delete para eliminar cada hoja de estilos
3. Observá y capturá

**Estado:** ✅ Completo — contenido legible y funcional, orden lógico preservado. Ver INFORME.md sección 5.

---

## 5. Diferentes navegadores

**Pantallas a probar:** `/pedal`, `/ajustes`, `/partitura`

| Browser | Verificar |
|---|---|
| Chrome | Referencia base — layout, foco, aria-live |
| Firefox | Layout, foco visible, aria-live |
| Edge | Compatibilidad general (opcional) |

**Para cada navegador:**
- Navegá con Tab a través de todos los elementos interactivos
- Activá un botón con Enter/Espacio
- Verificá que el resultado sea equivalente al de Chrome

**Estado:** ✅ Completo — Chrome, Brave, Edge (Blink) y Firefox (Gecko) funcionan correctamente. Ver INFORME.md sección 5.

---

## 6. Diferentes resoluciones

**Herramienta:** Chrome DevTools — modo responsive (Ctrl+Shift+M)

| Resolución | Representa |
|---|---|
| 375×667 | iPhone SE |
| 390×844 | iPhone 14 |
| 768×1024 | Tablet |
| 1280×800 | Laptop |
| 1920×1080 | Desktop |

**Pasos:**
1. F12 → ícono de dispositivo (Ctrl+Shift+M)
2. Ingresá cada resolución manualmente
3. Verificá que el layout no se rompa y el texto sea legible
4. Capturá los extremos: móvil más chico (375×667) y desktop (1920×1080)

**Estado:** ✅ Completo — funcional en todos los tamaños; overflow detectado solo en iPhone SE con fuente muy grande. Ver INFORME.md sección 5.
