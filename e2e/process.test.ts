import type { RunningCommand } from './process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runCommand, spawnCommand } from './process'

const resources: Array<{ command: RunningCommand, directory: string }> = []

const serverSource = `
const fs = require('node:fs');
const http = require('node:http');
if (process.argv.includes('--ignore-term')) process.on('SIGTERM', () => {});
const server = http.createServer((request, response) => response.end('owned server'));
server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync('ready.json', JSON.stringify({ pid: process.pid, parentPid: process.ppid, port: server.address().port }));
});
`

const wrapperSource = `
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['server.cjs', ...process.argv.slice(2)], { stdio: process.argv.includes('--ignore-stdio') ? 'ignore' : 'inherit' });
child.on('error', error => { throw error; });
if (process.argv.includes('--exit-wrapper')) {
  const timer = setInterval(() => {
    if (fs.existsSync('ready.json')) {
      clearInterval(timer);
      process.once('exit', () => fs.writeFileSync('wrapper-exited.json', JSON.stringify({ pid: process.pid })));
      process.exit(process.argv.includes('--exit-failure') ? 7 : 0);
    }
  }, 10);
}
`

async function reachable(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(500) })
    return response.ok
  }
  catch {
    return false
  }
}

async function forceStopFixtureServer(pid: number, url: string) {
  try {
    process.kill(pid, 'SIGKILL')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error
    }
  }
  await expect.poll(() => reachable(url)).toBe(false)
}

async function createFixtureDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'twm process ownership '))
  await fs.writeFile(path.join(directory, 'server.cjs'), serverSource)
  await fs.writeFile(path.join(directory, 'wrapper.cjs'), wrapperSource)
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
    private: true,
    scripts: { preview: 'node server.cjs' },
  }))
  return directory
}

async function startFixture(options: { exitWrapper?: boolean, ignoreTerm?: boolean, pnpm?: boolean } = {}) {
  const directory = await createFixtureDirectory()
  const args = [
    'wrapper.cjs',
    ...(options.exitWrapper ? ['--exit-wrapper'] : []),
    ...(options.ignoreTerm ? ['--ignore-term'] : []),
  ]
  const command = options.pnpm
    ? spawnCommand('pnpm', ['run', 'preview'], { cwd: directory })
    : spawnCommand(process.execPath, args, { cwd: directory, shell: false })
  resources.push({ command, directory })
  let ready: { pid: number, parentPid: number, port: number } | undefined
  for (let attempt = 0; attempt < 300; attempt++) {
    try {
      ready = JSON.parse(await fs.readFile(path.join(directory, 'ready.json'), 'utf8'))
      break
    }
    catch {
      await delay(50)
    }
  }
  if (!ready) {
    await command.stop({ gracefulTimeoutMs: 100 })
    const result = await command.completed
    throw new Error(`Fixture did not start: ${result.stdout}\n${result.stderr}`)
  }
  return { command, directory, ...ready, url: `http://127.0.0.1:${ready.port}/` }
}

afterEach(async () => {
  const failures: unknown[] = []
  for (const { command, directory } of resources.splice(0).reverse()) {
    try {
      await command.stop({ gracefulTimeoutMs: 100 })
      await fs.rm(directory, { recursive: true, force: true })
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, 'Failed to clean up owned process fixtures')
  }
})

describe('owned command lifecycle', () => {
  it('stops descendants without touching another command and is idempotent', async () => {
    const target = await startFixture()
    const unrelated = await startFixture()
    expect(await reachable(target.url)).toBe(true)
    expect(await reachable(unrelated.url)).toBe(true)

    await Promise.all([target.command.stop(), target.command.stop()])

    await expect.poll(() => reachable(target.url)).toBe(false)
    expect(await reachable(unrelated.url)).toBe(true)
    await target.command.stop()
  })

  it('cleans descendants after their wrapper has already exited', async () => {
    const target = await startFixture({ exitWrapper: true })
    await expect.poll(() => fs.readFile(path.join(target.directory, 'wrapper-exited.json'), 'utf8')).toBeTruthy()
    expect(await reachable(target.url)).toBe(true)

    await target.command.stop({ gracefulTimeoutMs: 100 })

    await expect.poll(() => reachable(target.url)).toBe(false)
    await target.command.completed
  })

  it('force-stops a descendant that ignores graceful termination', async () => {
    const target = await startFixture({ ignoreTerm: true })
    expect(await reachable(target.url)).toBe(true)

    await target.command.stop({ gracefulTimeoutMs: 100, forceTimeoutMs: 3000 })

    await expect.poll(() => reachable(target.url)).toBe(false)
  })

  it('cleans the real pnpm preview process and its separate script group', async () => {
    const target = await startFixture({ pnpm: true })
    expect(await reachable(target.url)).toBe(true)

    await target.command.stop({ gracefulTimeoutMs: 1000, forceTimeoutMs: 3000 })

    await expect.poll(() => reachable(target.url)).toBe(false)
    await target.command.completed
  })

  it.skipIf(process.platform === 'win32')('tolerates EPERM only after the owned process group is empty', async () => {
    const command = spawnCommand(process.execPath, ['-e', 'console.log(process.pid)'], { shell: false })
    const result = await command.completed
    const group = -Number(result.stdout.trim())
    const originalKill = process.kill.bind(process)
    const denied = Object.assign(new Error('simulated zombie group permission boundary'), { code: 'EPERM' })
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid === group) {
        throw denied
      }
      return originalKill(pid, signal)
    })
    try {
      await expect(command.stop()).resolves.toBeUndefined()
    }
    finally {
      kill.mockRestore()
      await command.stop()
    }
  })

  it.skipIf(process.platform === 'win32')('reports EPERM for a live owned group and allows cleanup to be retried', async () => {
    const target = await startFixture()
    const originalKill = process.kill.bind(process)
    const denied = Object.assign(new Error('simulated live group permission denial'), { code: 'EPERM' })
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid === -target.parentPid) {
        throw denied
      }
      return originalKill(pid, signal)
    })
    try {
      await expect(target.command.stop()).rejects.toBe(denied)
      expect(await reachable(target.url)).toBe(true)
    }
    finally {
      kill.mockRestore()
    }
    await target.command.stop()
    await expect.poll(() => reachable(target.url)).toBe(false)
  })

  for (const stdio of ['inherit', 'ignore']) {
    for (const exitCode of [0, 7]) {
      it(`cleans finite command descendants with ${stdio} output after wrapper exits ${exitCode}`, async () => {
        const directory = await createFixtureDirectory()
        const controller = new AbortController()
        let settled = false
        const outcome = runCommand(process.execPath, [
          'wrapper.cjs',
          '--exit-wrapper',
          ...(stdio === 'ignore' ? ['--ignore-stdio'] : []),
          ...(exitCode === 7 ? ['--exit-failure'] : []),
        ], { cwd: directory, shell: false, signal: controller.signal }).then(
          result => ({ status: 'fulfilled' as const, result }),
          error => ({ status: 'rejected' as const, error }),
        ).finally(() => {
          settled = true
        })
        let ready: { pid: number, port: number } | undefined
        let url: string | undefined
        try {
          await expect.poll(async () => {
            ready = JSON.parse(await fs.readFile(path.join(directory, 'ready.json'), 'utf8'))
            return ready
          }, { timeout: 15_000 }).toBeTruthy()
          if (!ready) {
            throw new Error('Finite command server did not start')
          }
          url = `http://127.0.0.1:${ready.port}/`
          await expect.poll(() => settled, { timeout: 5000 }).toBe(true)
          const result = await outcome
          if (exitCode === 0) {
            expect(result.status).toBe('fulfilled')
            if (result.status === 'fulfilled') {
              expect(result.result.exitCode).toBe(0)
            }
          }
          else {
            expect(result.status).toBe('rejected')
            if (result.status === 'rejected') {
              expect(String(result.error)).toContain('Command failed')
            }
          }
          expect(await reachable(url)).toBe(false)
        }
        finally {
          controller.abort()
          // An assertion failure must still clean this exact fixture process,
          // including when testing a regression in runCommand itself.
          if (ready && url && await reachable(url)) {
            await forceStopFixtureServer(ready.pid, url)
          }
          await outcome
          await fs.rm(directory, { recursive: true, force: true })
        }
      })
    }
  }

  it('preserves argv, cwd, environment and exit status through the launcher', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'twm argv spaces '))
    const argument = 'spaces "quotes" & $literal; apostrophe\''
    try {
      const result = await runCommand(process.execPath, [
        '-e',
        'console.log(JSON.stringify({ args: process.argv.slice(1), cwd: process.cwd(), value: process.env.TWM_PROCESS_ARGUMENT }))',
        argument,
      ], {
        cwd: directory,
        shell: false,
        env: { ...process.env, TWM_PROCESS_ARGUMENT: argument },
      })
      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.trim())
      expect(output.args).toEqual([argument])
      expect(await fs.realpath(output.cwd)).toBe(await fs.realpath(directory))
      expect(output.value).toBe(argument)
      await expect(runCommand(process.execPath, ['-e', 'process.exit(7)'], { shell: false })).rejects.toThrow('Command failed')
    }
    finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
