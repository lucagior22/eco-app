import type { Metadata, Viewport } from 'next'
import { Atkinson_Hyperlegible, Inter, Lexend } from 'next/font/google'
import './globals.css'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { SkipLink } from '@/components/layout/SkipLink'
import { Navigation } from '@/components/layout/Navigation'
import { WelcomeModal } from '@/components/layout/WelcomeModal'

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-hyperlegible',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
  display: 'swap',
})

// Script anti-flash: lee las preferencias del localStorage ANTES del primer
// render y aplica data-theme y data-font-size al <html>, evitando el flash
// visual del tema/tamaño por defecto antes de que React hidrate.
// Se usa dangerouslySetInnerHTML porque el script debe ejecutarse de forma
// síncrona en el <head> — si se cargara como módulo o defer, llegaría tarde.
const ANTI_FLASH_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem('eco-settings');
    if (raw) {
      var s = JSON.parse(raw);
      if (s.theme) document.documentElement.setAttribute('data-theme', s.theme);
      if (s.fontSize) document.documentElement.setAttribute('data-font-size', s.fontSize);
      if (s.fontFamily) document.documentElement.setAttribute('data-font-family', s.fontFamily);
    }
  } catch (e) {
    // JSON inválido o localStorage inaccesible: quedan los defaults (light/md/hyperlegible)
  }
})();
`

export const metadata: Metadata = {
  title: 'Eco — Asistente musical accesible',
  description:
    'PWA de asistencia musical para músicos con discapacidad visual. Afinador, lector de partituras, detección de pedales y metrónomo.',
}

// themeColor va en viewport (Next 15 separa metadata de viewport)
export const viewport: Viewport = {
  themeColor: '#F2F2F7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme, data-font-size y data-font-family los aplica el script anti-flash en el cliente.
    // En SSR quedan sin atributo → caen a los defaults de globals.css (:root).
    // Las clases de fuentes hacen disponibles las CSS variables --font-* para globals.css.
    <html lang="es" className={`${atkinson.variable} ${inter.variable} ${lexend.variable}`}>
      <head>
        {/* Script síncrono para evitar flash de tema/tamaño incorrecto.
            Debe estar en <head> antes de cualquier CSS que dependa de data-theme. */}
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SettingsProvider>
          <WelcomeModal />
          {/* SkipLink debe ser el PRIMER elemento focusable — antes del nav */}
          <SkipLink />
          <Navigation />
          {/* Offset para el nav: en mobile padding-bottom para la bottom bar,
              en desktop margin-left para la sidebar */}
          <main id="main-content" className="flex-1 pb-[72px] md:ml-20 md:pb-0" tabIndex={-1}>
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  )
}
