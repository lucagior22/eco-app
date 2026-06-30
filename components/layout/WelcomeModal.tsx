'use client'

// Accesibilidad: diálogo modal que se abre una sola vez al primer ingreso a la app.
// Usa react-aria-components (Modal/Dialog) que provee focus trap, cierre con Escape,
// role="dialog" + aria-modal y restauración de foco. El Heading slot="title" queda
// como aria-labelledby del diálogo, así el screen reader anuncia el título al abrir.
// El estado "ya visto" se persiste en localStorage para no reabrir en visitas futuras.
// Se renderiza solo tras montar (lectura de localStorage en el cliente) para evitar
// mismatch de hidratación y el flash del modal en SSR.

import { useEffect, useState } from 'react'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

const SEEN_KEY = 'eco-welcome-seen'

const SECTION_TITLE = 'mt-5 text-lg font-bold text-[var(--color-text-primary)]'
const SECTION_TEXT = 'mt-1 text-[var(--color-text-secondary)]'

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== 'true') setIsOpen(true)
    } catch {
      // localStorage inaccesible (modo privado, etc.): no mostramos el modal
    }
  }, [])

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
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
        <Dialog className="outline-none">
          {({ close }) => (
            <>
              <Heading
                slot="title"
                className="text-2xl font-bold text-[var(--color-text-primary)]"
              >
                Bienvenido a Eco
              </Heading>

              <h3 className={SECTION_TITLE}>Qué es Eco</h3>
              <p className={SECTION_TEXT}>
                Eco es un asistente musical pensado para músicos con discapacidad visual o ceguera.
                Funciona enteramente con narración por voz y navegación por teclado, sin necesidad de
                ver la pantalla.
              </p>

              <h3 className={SECTION_TITLE}>Qué resuelve</h3>
              <p className={SECTION_TEXT}>
                Tareas musicales cotidianas que suelen depender de la vista —afinar, leer partituras,
                marcar el tempo o reconocer un pedal de efecto— acá se resuelven de forma accesible:
                la app te dice en voz alta lo que está pasando.
              </p>

              <h3 className={SECTION_TITLE}>Funciones</h3>
              <ul className={`${SECTION_TEXT} list-disc space-y-1 pl-5`}>
                <li>Afinador: detecta la nota que tocás y te dice si está afinada, alta o baja.</li>
                <li>Leer partitura: tomá una foto o subí un archivo y escuchá los acordes detectados.</li>
                <li>Metrónomo: marca el tempo con sonido y vibración, con BPM y compás ajustables.</li>
                <li>Detectar pedal: enfocá un pedal con la cámara y conocé la posición de sus perillas.</li>
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

              <div className="mt-6 flex justify-end">
                <Button
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
