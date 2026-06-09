'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface MicDevice {
  deviceId: string
  label: string
}

export interface UseMicrophoneResult {
  stream: MediaStream | null
  isActive: boolean
  error: string | null
  devices: MicDevice[]
  selectedDeviceId: string
  selectDevice: (deviceId: string) => void
}

export function useMicrophone(): UseMicrophoneResult {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MicDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const streamRef = useRef<MediaStream | null>(null)

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const mics = all
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Micrófono ${i + 1}`,
        }))
      setDevices(mics)
    } catch {
      // enumerateDevices puede fallar si no hay permiso
    }
  }, [])

  const openStream = useCallback(
    async (deviceId?: string) => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        setError('Micrófono no disponible en este dispositivo')
        return
      }
      try {
        const audio: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        }
        const s = await navigator.mediaDevices.getUserMedia({ audio })
        streamRef.current = s
        setStream(s)
        setIsActive(true)
        setError(null)
        await enumerateDevices()
      } catch (err) {
        const isDenied = err instanceof DOMException && err.name === 'NotAllowedError'
        setError(isDenied ? 'Permiso de micrófono denegado' : 'No se pudo acceder al micrófono')
        setIsActive(false)
      }
    },
    [enumerateDevices],
  )

  useEffect(() => {
    openStream()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [openStream])

  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId)
      openStream(deviceId)
    },
    [openStream],
  )

  return { stream, isActive, error, devices, selectedDeviceId, selectDevice }
}
