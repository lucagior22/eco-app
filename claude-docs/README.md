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
