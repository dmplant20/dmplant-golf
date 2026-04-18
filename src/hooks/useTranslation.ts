'use client'
import { useAuthStore } from '@/stores/authStore'
import ko from '@/i18n/locales/ko/common.json'
import en from '@/i18n/locales/en/common.json'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

const messages = { ko, en }

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj) as string ?? path
}

export function useTranslation() {
  const lang = useAuthStore((s) => s.lang)
  const t = (key: string): string => getNestedValue(messages[lang] as Record<string, unknown>, key)
  return { t, lang }
}
