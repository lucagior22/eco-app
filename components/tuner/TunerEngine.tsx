'use client'

// Componente lógico: gestiona AudioContext + pitchfinder (algoritmo YIN,
// buffer 2048 ~46ms de latencia a 44100 Hz). No renderiza UI propia.
// Accesibilidad: no tiene elementos DOM visibles. Los cambios de estado
// se comunican a los componentes de presentación (TunerDisplay, PitchIndicator)
// via props o contexto.

// TODO: implementar en la fase Afinador

export default function TunerEngine() {
  return null
}
