import type { ChildProcessByStdio, SpawnOptionsWithoutStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { spawn } from 'node:child_process'

export interface CommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

export interface RunningCommand {
  readonly exitCode: number | null
  kill: (signal?: NodeJS.Signals | number) => boolean
  completed: Promise<CommandResult>
}

function createCommandResult(child: ChildProcessByStdio<null, Readable, Readable>) {
  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const completed = new Promise<CommandResult>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr,
      })
    })
  })

  return {
    get exitCode() {
      return child.exitCode
    },
    kill(signal?: NodeJS.Signals | number) {
      return child.kill(signal)
    },
    completed,
  } satisfies RunningCommand
}

export function spawnCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
): RunningCommand {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return createCommandResult(child)
}

export async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
) {
  const result = await spawnCommand(command, args, options).completed

  if (result.exitCode !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim()
    throw new Error(`Command failed (${command} ${args.join(' ')}): ${output}`)
  }

  return result
}
