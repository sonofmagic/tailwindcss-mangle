import type { RegistryOptions } from '@tailwindcss-mangle/config'
import type { TailwindCssPatchOptions } from './types'

const deprecatedRegistryMapping = {
  output: 'extract',
  tailwind: 'tailwindcss',
} as const

type DeprecatedRegistryKey = keyof typeof deprecatedRegistryMapping

const deprecatedTailwindMapping = {
  package: 'packageName',
  legacy: 'v2',
  classic: 'v3',
  next: 'v4',
} as const

type DeprecatedTailwindKey = keyof typeof deprecatedTailwindMapping

function assertNoDeprecatedRegistryOptions(registry: RegistryOptions) {
  const usedRegistryKeys = (Object.keys(deprecatedRegistryMapping) as DeprecatedRegistryKey[])
    .filter(key => Object.prototype.hasOwnProperty.call(registry, key))

  if (usedRegistryKeys.length > 0) {
    const mapping = usedRegistryKeys.map(key => `${key} -> ${deprecatedRegistryMapping[key]}`).join(', ')
    throw new Error(
      `Legacy registry fields are no longer supported: ${usedRegistryKeys.join(', ')}. Use the modern fields instead: ${mapping}.`,
    )
  }

  const tailwind = registry.tailwindcss
  if (!tailwind) {
    return
  }

  const usedTailwindKeys = (Object.keys(deprecatedTailwindMapping) as DeprecatedTailwindKey[])
    .filter(key => Object.prototype.hasOwnProperty.call(tailwind, key))

  if (usedTailwindKeys.length > 0) {
    const mapping = usedTailwindKeys.map(key => `${key} -> tailwindcss.${deprecatedTailwindMapping[key]}`).join(', ')
    throw new Error(
      `Legacy "registry.tailwindcss" fields are no longer supported: ${usedTailwindKeys.join(', ')}. Use the modern fields instead: ${mapping}.`,
    )
  }
}

export function fromUnifiedConfig(registry?: RegistryOptions): TailwindCssPatchOptions {
  if (!registry) {
    return {}
  }

  assertNoDeprecatedRegistryOptions(registry)

  const extract = registry.extract
    ? {
        ...(registry.extract.write === undefined ? {} : { write: registry.extract.write }),
        ...(registry.extract.file === undefined ? {} : { file: registry.extract.file }),
        ...(registry.extract.format === undefined ? {} : { format: registry.extract.format }),
        ...(registry.extract.pretty === undefined ? {} : { pretty: registry.extract.pretty }),
        ...(registry.extract.removeUniversalSelector === undefined ? {} : { removeUniversalSelector: registry.extract.removeUniversalSelector }),
      }
    : undefined

  const tailwindcss = registry.tailwindcss
    ? {
        ...(registry.tailwindcss.version === undefined ? {} : { version: registry.tailwindcss.version }),
        ...(registry.tailwindcss.packageName === undefined ? {} : { packageName: registry.tailwindcss.packageName }),
        ...(registry.tailwindcss.resolve === undefined ? {} : { resolve: registry.tailwindcss.resolve }),
        ...(registry.tailwindcss.config === undefined ? {} : { config: registry.tailwindcss.config }),
        ...(registry.tailwindcss.cwd === undefined ? {} : { cwd: registry.tailwindcss.cwd }),
        ...(registry.tailwindcss.v2 === undefined ? {} : { v2: registry.tailwindcss.v2 }),
        ...(registry.tailwindcss.v3 === undefined ? {} : { v3: registry.tailwindcss.v3 }),
        ...(registry.tailwindcss.v4 === undefined ? {} : { v4: registry.tailwindcss.v4 }),
      }
    : undefined

  const apply = registry.apply
    ? {
        ...(registry.apply.overwrite === undefined ? {} : { overwrite: registry.apply.overwrite }),
        ...(registry.apply.exposeContext === undefined ? {} : { exposeContext: registry.apply.exposeContext }),
        ...(registry.apply.extendLengthUnits === undefined ? {} : { extendLengthUnits: registry.apply.extendLengthUnits }),
      }
    : undefined

  return {
    ...(registry.projectRoot === undefined ? {} : { projectRoot: registry.projectRoot }),
    ...(apply === undefined ? {} : { apply }),
    ...(registry.cache === undefined ? {} : { cache: registry.cache }),
    ...(registry.filter === undefined ? {} : { filter: registry.filter }),
    ...(extract === undefined ? {} : { extract }),
    ...(tailwindcss === undefined ? {} : { tailwindcss }),
  }
}
