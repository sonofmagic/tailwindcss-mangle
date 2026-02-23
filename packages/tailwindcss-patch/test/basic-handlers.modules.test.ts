import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../src/logger'
import {
  extractCommandDefaultHandler,
  initCommandDefaultHandler,
  installCommandDefaultHandler,
  tokensCommandDefaultHandler,
} from '../src/commands/basic-handlers'

const {
  patchMock,
  ensureDirMock,
  writeJSONMock,
  writeFileMock,
  loadWorkspaceConfigModuleMock,
  initConfigMock,
  groupTokensByFileMock,
} = vi.hoisted(() => ({
  patchMock: vi.fn(async () => undefined),
  ensureDirMock: vi.fn(async () => undefined),
  writeJSONMock: vi.fn(async () => undefined),
  writeFileMock: vi.fn(async () => undefined),
  loadWorkspaceConfigModuleMock: vi.fn(),
  initConfigMock: vi.fn(async () => undefined),
  groupTokensByFileMock: vi.fn(),
}))

vi.mock('../src/api/tailwindcss-patcher', () => {
  function TailwindcssPatcherMock() {
    return {
      patch: patchMock,
    }
  }

  return {
    TailwindcssPatcher: vi.fn(TailwindcssPatcherMock),
  }
})

vi.mock('fs-extra', () => {
  return {
    default: {
      ensureDir: ensureDirMock,
      writeJSON: writeJSONMock,
      writeFile: writeFileMock,
    },
  }
})

vi.mock('../src/config/workspace', () => {
  return {
    loadWorkspaceConfigModule: loadWorkspaceConfigModuleMock,
  }
})

vi.mock('../src/extraction/candidate-extractor', () => {
  return {
    groupTokensByFile: groupTokensByFileMock,
  }
})

vi.mock('../src/logger', () => {
  return {
    default: {
      success: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('basic command handlers module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadWorkspaceConfigModuleMock.mockResolvedValue({
      initConfig: initConfigMock,
      CONFIG_NAME: 'tailwindcss-mangle',
    })
  })

  it('install handler patches runtime via TailwindcssPatcher', async () => {
    await installCommandDefaultHandler({} as any)

    expect(patchMock).toHaveBeenCalledOnce()
    expect(logger.success).toHaveBeenCalledWith('Tailwind CSS runtime patched successfully.')
  })

  it('extract handler forwards overrides to createPatcher and write option to extract', async () => {
    const extractMock = vi.fn(async () => ({
      classList: ['a', 'b'],
      filename: '.tw-patch/classes.json',
    }))
    const createPatcherMock = vi.fn(async () => ({
      extract: extractMock,
    }))

    const ctx = {
      args: {
        cwd: '/tmp/project',
        output: '.tw-patch/custom-classes.txt',
        format: 'lines',
        css: 'src/tailwind.css',
        write: false,
      },
      createPatcher: createPatcherMock,
    } as any

    await extractCommandDefaultHandler(ctx)

    expect(createPatcherMock).toHaveBeenCalledWith({
      extract: {
        file: '.tw-patch/custom-classes.txt',
        format: 'lines',
      },
      tailwindcss: {
        v4: {
          cssEntries: ['src/tailwind.css'],
        },
      },
    })
    expect(extractMock).toHaveBeenCalledWith({ write: false })
  })

  it('extract handler uses defaults when no overrides are provided', async () => {
    const extractMock = vi.fn(async () => ({
      classList: ['x'],
    }))
    const createPatcherMock = vi.fn(async () => ({
      extract: extractMock,
    }))

    const ctx = {
      args: {
        cwd: '/tmp/project',
      },
      createPatcher: createPatcherMock,
    } as any

    await extractCommandDefaultHandler(ctx)

    expect(createPatcherMock).toHaveBeenCalledWith(undefined)
    expect(extractMock).toHaveBeenCalledWith({})
  })

  it('tokens handler writes grouped json output when format is grouped-json', async () => {
    const report = {
      entries: [
        {
          rawCandidate: 'text-blue-500',
          file: '/tmp/project/src/a.ts',
          relativeFile: 'src/a.ts',
          extension: '.ts',
          start: 0,
          end: 13,
          length: 13,
          line: 1,
          column: 1,
          lineText: 'text-blue-500',
        },
      ],
      filesScanned: 1,
      skippedFiles: [],
      sources: [],
    }
    const grouped = {
      'src/a.ts': report.entries,
    }
    groupTokensByFileMock.mockReturnValue(grouped)

    const ctx = {
      args: {
        cwd: '/tmp/project',
        output: '.tw-patch/tokens-grouped.json',
        format: 'grouped-json',
        groupKey: 'relative',
        write: true,
      },
      createPatcher: async () => ({
        collectContentTokens: async () => report,
      }),
    } as any

    await tokensCommandDefaultHandler(ctx)

    const target = path.resolve('.tw-patch/tokens-grouped.json')
    expect(ensureDirMock).toHaveBeenCalledWith(path.dirname(target))
    expect(groupTokensByFileMock).toHaveBeenCalledWith(report, {
      key: 'relative',
      stripAbsolutePaths: true,
    })
    expect(writeJSONMock).toHaveBeenCalledWith(target, grouped, { spaces: 2 })
  })

  it('tokens handler prints lines preview when write is disabled', async () => {
    const entries = Array.from({ length: 6 }).map((_, index) => ({
      rawCandidate: `text-${index}`,
      file: `/tmp/project/src/${index}.ts`,
      relativeFile: `src/${index}.ts`,
      extension: '.ts',
      start: index,
      end: index + 1,
      length: 1,
      line: index + 1,
      column: 1,
      lineText: `text-${index}`,
    }))
    const report = {
      entries,
      filesScanned: 6,
      skippedFiles: [],
      sources: [],
    }
    const infoSpy = vi.spyOn(logger as any, 'info')
    const logSpy = vi.spyOn(logger as any, 'log')

    const ctx = {
      args: {
        cwd: '/tmp/project',
        format: 'lines',
        write: false,
      },
      createPatcher: async () => ({
        collectContentTokens: async () => report,
      }),
    } as any

    await tokensCommandDefaultHandler(ctx)

    expect(ensureDirMock).not.toHaveBeenCalled()
    expect(writeJSONMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('')
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('src/0.ts:1:1 text-0'))
    expect(infoSpy).toHaveBeenCalledWith('…and 1 more.')
  })

  it('init handler loads workspace config module and initializes default config file', async () => {
    const ctx = {
      cwd: '/tmp/project',
    } as any

    await initCommandDefaultHandler(ctx)

    expect(loadWorkspaceConfigModuleMock).toHaveBeenCalledOnce()
    expect(initConfigMock).toHaveBeenCalledWith('/tmp/project')
    expect(logger.success).toHaveBeenCalledWith('✨ tailwindcss-mangle.config.ts initialized!')
  })
})
