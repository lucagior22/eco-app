import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeSetting } from '@/components/settings/ThemeSetting'
import { FontSizeSetting } from '@/components/settings/FontSizeSetting'
import { FontFamilySetting } from '@/components/settings/FontFamilySetting'
import { TtsSpeedSetting } from '@/components/settings/TtsSpeedSetting'
import { VibrationSetting } from '@/components/settings/VibrationSetting'
export const metadata: Metadata = {
  title: 'Ajustes — Eco',
}

export default function AjustesPage() {
  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Personalizá el tema, el tamaño de fuente y la velocidad del narrador"
      />
      <div className="flex flex-col gap-4 p-4">
        <ThemeSetting />
        <FontSizeSetting />
        <FontFamilySetting />
        <TtsSpeedSetting />
        <VibrationSetting />
      </div>
    </>
  )
}
