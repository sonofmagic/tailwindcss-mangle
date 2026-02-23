import type { Command } from 'cac'
import type { TailwindcssPatchCommandDefinitions } from './command-definitions'
import type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCommand,
  TailwindcssPatchCommandOptionDefinition,
  TailwindcssPatchCommandOptions,
} from './types'

function addPrefixIfMissing(value: string, prefix: string) {
  if (!prefix || value.startsWith(prefix)) {
    return value
  }
  return `${prefix}${value}`
}

function resolveCommandNames(
  command: TailwindcssPatchCommand,
  mountOptions: TailwindcssPatchCliMountOptions,
  prefix: string,
) {
  const override = mountOptions.commandOptions?.[command]
  const baseName = override?.name ?? command
  const name = addPrefixIfMissing(baseName, prefix)
  const aliases = (override?.aliases ?? []).map(alias => addPrefixIfMissing(alias, prefix))
  return { name, aliases }
}

function resolveOptionDefinitions(
  defaults: TailwindcssPatchCommandOptionDefinition[],
  override?: TailwindcssPatchCommandOptions,
) {
  if (!override) {
    return defaults
  }

  const appendDefaults = override.appendDefaultOptions ?? true
  const customDefs = override.optionDefs ?? []
  if (!appendDefaults) {
    return customDefs
  }

  if (customDefs.length === 0) {
    return defaults
  }

  return [...defaults, ...customDefs]
}

export function resolveCommandMetadata(
  command: TailwindcssPatchCommand,
  mountOptions: TailwindcssPatchCliMountOptions,
  prefix: string,
  defaults: TailwindcssPatchCommandDefinitions,
) {
  const names = resolveCommandNames(command, mountOptions, prefix)
  const definition = defaults[command]
  const override = mountOptions.commandOptions?.[command]
  const description = override?.description ?? definition.description
  const optionDefs = resolveOptionDefinitions(definition.optionDefs, override)
  return { ...names, description, optionDefs }
}

export function applyCommandOptions(command: Command, optionDefs: TailwindcssPatchCommandOptionDefinition[]) {
  for (const option of optionDefs) {
    command.option(option.flags, option.description ?? '', option.config)
  }
}
