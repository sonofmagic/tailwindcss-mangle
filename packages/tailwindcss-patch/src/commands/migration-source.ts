import { migrateConfigSourceNative } from '@tailwindcss-mangle/native'

export interface ConfigSourceMigrationResult {
  changed: boolean
  code: string
  changes: string[]
}

export function migrateConfigSource(source: string): ConfigSourceMigrationResult {
  return migrateConfigSourceNative(source)
}
