'use client'

// Accesibilidad — canal único de audio (useAnnouncer): cada sección vive en un <details> nativo
// (expandible sin JS, con foco y estado aria-expanded propios del elemento). Al abrirla se narra
// su contenido y al cerrarla se corta la locución, así el usuario elige qué escuchar en vez de
// atravesar toda la pantalla. El <h2> va dentro del <summary> para no perder la navegación por
// encabezados del lector de pantalla.

import type { ToggleEvent } from 'react'
import LiveRegion from '@/components/a11y/LiveRegion'
import { useAnnouncer } from '@/hooks/useAnnouncer'
import { cancelSpeech } from '@/lib/tts'

interface InfoSection {
  title: string
  body: readonly string[]
}

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

const SECTIONS: readonly InfoSection[] = [
  {
    title: 'Qué es Eco y para quién',
    body: [
      'Eco es un asistente musical pensado para músicos con discapacidad visual o ceguera.',
      'Resuelve tareas musicales cotidianas que suelen depender de la vista: afinar el instrumento, leer una partitura, marcar el tempo o reconocer la configuración de un pedal de efecto.',
      'Todo lo que pasa en la app se dice en voz alta, y todo se puede usar con el teclado. No hace falta ver la pantalla en ningún momento.',
      'Eco funciona en el navegador y se puede instalar como aplicación en el teléfono o en la computadora.',
    ],
  },
  {
    title: 'Afinador',
    body: [
      'Escucha tu instrumento por el micrófono y te dice qué nota estás tocando y si está afinada, un poco alta o un poco baja.',
      'Al entrar, el navegador pide permiso para usar el micrófono. Hay que aceptarlo una vez.',
      'Tocá una cuerda y esperá: la app narra la cuerda, la nota y qué tan lejos está de estar afinada.',
      'Si querés afinar una cuerda puntual, elegila en la fila de cuerdas. Con la cuerda fija, la detección se concentra en esa frecuencia y es más precisa, sobre todo en la sexta cuerda.',
      'En la computadora también podés elegir qué micrófono usar.',
    ],
  },
  {
    title: 'Leer partitura',
    body: [
      'Convierte la foto de una partitura o de un cifrado en una lista de acordes que podés escuchar.',
      'Podés sacar una foto con la cámara o subir un archivo de imagen que ya tengas.',
      'La app narra el estado del proceso mientras analiza la imagen, y después lee los acordes detectados en orden.',
      'Funciona mejor con cifrado de acordes escrito con letras, como Do, Re o Am, que con notación musical impresa. Si la foto está movida o con poca luz, puede no detectar nada: la app te lo dice en vez de inventar un resultado.',
    ],
  },
  {
    title: 'Metrónomo',
    body: [
      'Marca el tempo con sonido y con vibración, para practicar con ritmo.',
      'Se ajustan las pulsaciones por minuto y el compás. Si mantenés presionado un botón de ajuste, el cambio se acelera.',
      'El primer tiempo de cada compás suena acentuado y vibra con un patrón distinto, así se distingue sin mirar.',
      'La vibración se puede activar o desactivar desde la misma pantalla del metrónomo, sin ir a Ajustes.',
    ],
  },
  {
    title: 'Detectar pedal',
    body: [
      'Usa la cámara para reconocer un pedal de efecto y describir la posición de sus perillas.',
      'Enfocá el pedal de frente, a unos veinte centímetros, con buena luz. La app va narrando indicaciones para acomodar la toma.',
      'Cuando no está segura de lo que ve, lo dice explícitamente en vez de arriesgar una respuesta equivocada. Si eso pasa, no es un error tuyo: probá cambiando la distancia, el ángulo o la iluminación.',
      'Esta es la única pantalla que necesita conexión a internet: las fotos del pedal se envían a un servicio de análisis de imágenes de Google para poder leer las perillas. El resto de la app funciona sin conexión y sin enviar nada.',
    ],
  },
  {
    title: 'Ajustes',
    body: [
      'Ahí se personaliza cómo se ve y cómo suena la app. Las preferencias quedan guardadas para la próxima vez.',
      'Contraste y color: cuatro temas, claro, oscuro y dos de alto contraste.',
      'Tamaño de letra: cuatro tamaños, del normal al muy grande.',
      'Tipografía: fuentes elegidas por su legibilidad, incluida una diseñada para baja visión.',
      'Velocidad del narrador: cinco velocidades. Al cambiarla, la escuchás de inmediato.',
      'Vibración: activa o desactiva la respuesta háptica de toda la app.',
    ],
  },
  {
    title: 'Opciones de accesibilidad',
    body: [
      'Narración por voz de cada acción, resultado y error.',
      'Navegación completa por teclado, con el foco siempre visible.',
      'Un link "Ir al contenido principal" como primer elemento de cada pantalla, para saltear la navegación.',
      'Ningún estado se comunica solo con color: siempre hay además texto o un ícono.',
      'La app funciona con el lector de pantalla del sistema, y también sin él gracias a su propio narrador.',
    ],
  },
  {
    title: 'Preguntas frecuentes',
    body: [
      '¿Por qué no escucho nada al abrir la app? Los navegadores no dejan que una página hable antes de que la toques. La primera locución queda guardada y sale apenas tocás la pantalla o presionás una tecla.',
      '¿Necesito internet? Para usar el afinador, el metrónomo y los ajustes, no. Leer una partitura sí necesita conexión, porque el análisis de la imagen se hace en el servidor.',
      '¿Se guarda mi voz, mis fotos o mi audio? No. El audio del micrófono se procesa en tu propio dispositivo y no se envía a ningún lado. Las fotos de partituras se analizan y se descartan.',
      '¿Puedo usar Eco con mi lector de pantalla? Sí. La app está construida con HTML semántico y ARIA, y su narrador propio se coordina con el lector para no hablar los dos encima.',
      '¿Cómo vuelvo a ver el mensaje de bienvenida? Se muestra una sola vez por dispositivo. Esta pantalla contiene la misma información, ampliada.',
      '¿Por qué el afinador dice una cuerda que no toqué? Puede pasar si hay ruido de fondo o si dos cuerdas suenan juntas. Elegí la cuerda que querés afinar en la fila de cuerdas para que la detección se concentre en ella.',
    ],
  },
]

export default function InformacionContent() {
  const { announce, announcement, liveMode } = useAnnouncer()

  function handleToggle(event: ToggleEvent<HTMLDetailsElement>, section: InfoSection) {
    if (event.currentTarget.open) {
      announce(`${section.title}. ${section.body.join(' ')}`)
    } else {
      cancelSpeech()
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <LiveRegion announcement={announcement} liveMode={liveMode} />

      {SECTIONS.map((section) => (
        <details
          key={section.title}
          onToggle={(event) => handleToggle(event, section)}
          className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{section.title}</h2>
            <ChevronIcon />
          </summary>

          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-[var(--color-text-secondary)]">
              {paragraph}
            </p>
          ))}
        </details>
      ))}
    </div>
  )
}
