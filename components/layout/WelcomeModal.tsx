'use client'

// Accesibilidad: diálogo modal que se abre una sola vez al primer ingreso a la app.
// Usa react-aria-components (Modal/Dialog) que provee focus trap, cierre con Escape,
// role="dialog" + aria-modal y restauración de foco. El Heading slot="title" queda
// como aria-labelledby del diálogo, así el screen reader anuncia el título al abrir.
// El foco inicial va al botón "Comenzar" (autoFocus) y no al contenedor del diálogo:
// el indicador de foco queda visible sobre un elemento accionable.
// El estado "ya visto" se persiste en localStorage para no reabrir en visitas futuras.
// Se renderiza solo tras montar (lectura de localStorage en el cliente) para evitar
// mismatch de hidratación y el flash del modal en SSR.
//
// Canal único de audio (useAnnouncer): es la primera pantalla de la app y el usuario que no ve
// necesita escucharla. Se narra el resumen, no las cuatro secciones: leerlas enteras dura casi
// un minuto y nadie lo espera. El detalle vive en un <details> colapsado, accesible para quien
// lo quiera sin obligar a nadie a atravesarlo.

import { useEffect, useState } from 'react'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import LiveRegion from '@/components/a11y/LiveRegion'
import { useAnnouncer } from '@/hooks/useAnnouncer'
import { cancelSpeech } from '@/lib/tts'

const SEEN_KEY = 'eco-welcome-seen'

const SECTION_TITLE = 'mt-5 text-lg font-bold text-[var(--color-text-primary)]'
const SECTION_TEXT = 'mt-1 text-[var(--color-text-secondary)]'

// Fuente única del resumen: el mismo texto se ve y se escucha, así no pueden desincronizarse.
const SUMMARY =
  'Eco es un asistente musical para músicos con discapacidad visual o ceguera. Te ayuda a afinar tu instrumento, leer partituras, marcar el tempo y reconocer pedales de efecto, siempre narrando en voz alta lo que pasa. Presioná Comenzar para usar la app, o abrí el detalle para conocer cada función.'

// El triángulo nativo del <summary> no se puede estilar de forma consistente entre navegadores.
// Se oculta y se dibuja un chevron propio que rota al abrir; el estado sigue siendo el del
// <details>, así que el lector de pantalla lo anuncia igual sin ARIA agregado.
function ChevronIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[var(--color-text-secondary)] transition-transform group-open:rotate-180"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { announce, announcement, liveMode } = useAnnouncer()

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== 'true') setIsOpen(true)
    } catch {
      // localStorage inaccesible (modo privado, etc.): no mostramos el modal
    }
  }, [])

  // Todavía no hubo gesto del usuario, así que el navegador puede descartar esta locución.
  // lib/tts la retiene y la emite con el primer pointerdown/keydown.
  useEffect(() => {
    if (isOpen) announce(SUMMARY)
  }, [isOpen, announce])

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
      // Si el primer gesto del usuario fue justamente "Comenzar", el resumen retenido saldría
      // con el modal ya cerrado. Se descarta: la pantalla de destino narra lo suyo al montar.
      cancelSpeech()
      try {
        localStorage.setItem(SEEN_KEY, 'true')
      } catch {
        // si no se puede persistir, igual cerramos; volverá a aparecer en la próxima visita
      }
    }
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <Modal className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        <Dialog>
          {({ close }) => (
            <>
              <LiveRegion announcement={announcement} liveMode={liveMode} />

              <Heading
                slot="title"
                className="text-2xl font-bold text-[var(--color-text-primary)]"
              >
                Bienvenido a Eco
              </Heading>

              <p className={`${SECTION_TEXT} mt-3`}>{SUMMARY}</p>

              <details className="group mt-5 rounded-xl border border-[var(--color-border)] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-[var(--color-text-primary)] [&::-webkit-details-marker]:hidden">
                  Ver el detalle de todas las funciones
                  <ChevronIcon />
                </summary>

                <h3 className={SECTION_TITLE}>Qué es Eco</h3>
                <p className={SECTION_TEXT}>
                  Eco es un asistente musical pensado para músicos con discapacidad visual o
                  ceguera. Funciona enteramente con narración por voz y navegación por teclado, sin
                  necesidad de ver la pantalla.
                </p>

                <h3 className={SECTION_TITLE}>Qué resuelve</h3>
                <p className={SECTION_TEXT}>
                  Tareas musicales cotidianas que suelen depender de la vista —afinar, leer
                  partituras, marcar el tempo o reconocer un pedal de efecto— acá se resuelven de
                  forma accesible: la app te dice en voz alta lo que está pasando.
                </p>

                <h3 className={SECTION_TITLE}>Funciones</h3>
                <ul className={`${SECTION_TEXT} list-disc space-y-1 pl-5`}>
                  <li>Afinador: detecta la nota que tocás y te dice si está afinada, alta o baja.</li>
                  <li>
                    Leer partitura: tomá una foto o subí un archivo y escuchá los acordes detectados.
                  </li>
                  <li>Metrónomo: marca el tempo con sonido y vibración, con BPM y compás ajustables.</li>
                  <li>
                    Detectar pedal: enfocá un pedal con la cámara y conocé la posición de sus
                    perillas.
                  </li>
                  <li>Ajustes: personalizá tema, fuente y velocidad del narrador.</li>
                </ul>

                <h3 className={SECTION_TITLE}>Opciones de accesibilidad</h3>
                <ul className={`${SECTION_TEXT} list-disc space-y-1 pl-5`}>
                  <li>Narración por voz de cada acción y resultado.</li>
                  <li>Navegación completa por teclado, con foco siempre visible.</li>
                  <li>Temas de alto contraste, claro y oscuro.</li>
                  <li>Tamaño de letra ajustable y fuentes de alta legibilidad.</li>
                  <li>Velocidad del narrador configurable.</li>
                </ul>
              </details>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  onPress={() => announce(SUMMARY)}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-medium text-[var(--color-text-primary)] pressed:opacity-70 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]"
                >
                  Escuchar explicación
                </Button>
                <Button
                  // El foco inicial del diálogo tiene que caer en un elemento accionable y no en
                  // el contenedor: es la forma de restituir el indicador de foco sin recurrir a
                  // outline-none. La regla apunta al autoFocus en carga de página, no al de un
                  // modal, donde el foco ya se mueve solo por el focus trap de react-aria.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  onPress={close}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-accent)] px-6 py-3 font-medium text-white pressed:opacity-70 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]"
                >
                  Comenzar
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
