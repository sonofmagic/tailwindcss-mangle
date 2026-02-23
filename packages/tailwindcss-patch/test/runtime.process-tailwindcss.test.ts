import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runTailwindBuild } from '@/runtime/process-tailwindcss'

const { loadConfigMock } = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
}))

vi.mock('tailwindcss-config', () => {
  return {
    loadConfig: loadConfigMock,
  }
})

let tempDir: string
let pluginPath: string
let configPath: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-runtime-build-'))
  configPath = path.join(tempDir, 'tailwind.config.js')
  pluginPath = path.join(tempDir, 'test-plugin.cjs')

  await fs.writeFile(configPath, 'module.exports = { content: [] }', 'utf8')
  await fs.writeFile(
    pluginPath,
    [
      'module.exports = function testPlugin(opts) {',
      '  return {',
      '    postcssPlugin: "tw-patch-test-plugin",',
      '    Once(root, { result }) {',
      '      result.messages.push({ type: "config-path", value: opts.config })',
      '    },',
      '  }',
      '}',
    ].join('\n'),
    'utf8',
  )
  loadConfigMock.mockReset()
})

afterEach(async () => {
  await fs.remove(tempDir)
})

describe('runTailwindBuild', () => {
  it('uses absolute config directly and processes v3 input', async () => {
    const result = await runTailwindBuild({
      cwd: tempDir,
      config: configPath,
      majorVersion: 3,
      postcssPlugin: pluginPath,
    })

    expect(loadConfigMock).not.toHaveBeenCalled()
    expect(result.css).toContain('@tailwind base')
    expect(result.messages.some(x => x.type === 'config-path' && (x as any).value === configPath)).toBe(true)
  })

  it('resolves config via loadConfig when config is not absolute', async () => {
    loadConfigMock.mockResolvedValueOnce({ filepath: configPath })

    const result = await runTailwindBuild({
      cwd: tempDir,
      config: 'tailwind.config.js',
      majorVersion: 4,
      postcssPlugin: pluginPath,
    })

    expect(loadConfigMock).toHaveBeenCalledWith({ cwd: tempDir })
    expect(result.css).toContain('tailwindcss')
    expect(result.messages.some(x => x.type === 'config-path' && (x as any).value === configPath)).toBe(true)
  })

  it('throws when loadConfig cannot resolve a config file', async () => {
    loadConfigMock.mockResolvedValueOnce(undefined)

    await expect(runTailwindBuild({
      cwd: tempDir,
      majorVersion: 3,
      postcssPlugin: pluginPath,
    })).rejects.toThrow(`Unable to locate Tailwind CSS config from ${tempDir}`)
  })
})
