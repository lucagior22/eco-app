import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

// FlatCompat traduce configs legacy (ESLint 8) al formato flat de ESLint 9.
// Necesario porque eslint-config-next@15, jsx-a11y y react-hooks todavía
// publican configs en formato CJS legacy.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  // Ignorar los directorios generados que no son código fuente propio.
  // En ESLint 9 flat config, los ignores globales van como objeto separado
  // con solo la clave "ignores" (sin "files").
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'],
  },
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    // jsx-a11y/recommended activa el set completo de reglas de accesibilidad.
    // next/core-web-vitals solo activa un subset; necesitamos el set completo
    // porque la accesibilidad es la razón de ser de esta app.
    'plugin:jsx-a11y/recommended',
    // react-hooks/recommended detecta dependencias incorrectas en hooks y
    // otros errores comunes que pueden causar bugs sutiles.
    'plugin:react-hooks/recommended',
    // prettier DEBE ir al final para desactivar todas las reglas de ESLint
    // que conflictúan con el formato que maneja Prettier (punto y coma,
    // comillas, indentación, etc.). Si va antes, algún config posterior
    // podría re-activar esas reglas.
    'prettier'
  ),
]

export default eslintConfig
