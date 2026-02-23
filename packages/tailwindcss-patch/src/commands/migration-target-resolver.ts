import type { MigrateConfigFilesOptions } from './migration-types'
import {
  collectWorkspaceConfigFiles,
  DEFAULT_WORKSPACE_MAX_DEPTH,
  filterTargetFiles,
  resolveTargetFiles,
} from './migration-target-files'

export interface ResolveMigrationTargetFilesOptions {
  cwd: string
  files?: MigrateConfigFilesOptions['files']
  workspace?: MigrateConfigFilesOptions['workspace']
  maxDepth?: MigrateConfigFilesOptions['maxDepth']
  include?: MigrateConfigFilesOptions['include']
  exclude?: MigrateConfigFilesOptions['exclude']
}

export async function resolveMigrationTargetFiles(options: ResolveMigrationTargetFilesOptions) {
  const {
    cwd,
    files,
    workspace,
    maxDepth,
    include,
    exclude,
  } = options
  const resolvedMaxDepth = maxDepth ?? DEFAULT_WORKSPACE_MAX_DEPTH
  const discoveredTargetFiles = files && files.length > 0
    ? resolveTargetFiles(cwd, files)
    : workspace
      ? await collectWorkspaceConfigFiles(cwd, resolvedMaxDepth)
      : resolveTargetFiles(cwd)
  return filterTargetFiles(discoveredTargetFiles, cwd, include, exclude)
}
