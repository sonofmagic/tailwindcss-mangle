import type { ChildProcessByStdio, SpawnOptionsWithoutStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { Buffer } from 'node:buffer'
import { execFile, spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

export interface CommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

export interface StopCommandOptions {
  gracefulTimeoutMs?: number
  forceTimeoutMs?: number
}

export interface RunningCommand {
  readonly exitCode: number | null
  readonly exited: boolean
  stop: (options?: StopCommandOptions) => Promise<void>
  completed: Promise<CommandResult>
}

const execFileAsync = promisify(execFile)

// Windows process groups do not own descendants after a wrapper exits. A job
// keeps that ownership in the kernel, including children started by cmd/pnpm.
const windowsJobLauncher = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class E2EOwnedJob {
  [StructLayout(LayoutKind.Sequential)]
  struct BasicLimits {
    public long ProcessTime, JobTime;
    public uint Flags;
    public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
    public uint ActiveProcesses;
    public UIntPtr Affinity;
    public uint Priority, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct IoCounters {
    public ulong ReadOperations, WriteOperations, OtherOperations;
    public ulong ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct ExtendedLimits {
    public BasicLimits Basic;
    public IoCounters Io;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr information, uint size);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")]
  static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")]
  static extern bool CloseHandle(IntPtr handle);
  public static void Attach() {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) throw new Win32Exception();
    var limits = new ExtendedLimits();
    limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    int size = Marshal.SizeOf(limits);
    IntPtr buffer = Marshal.AllocHGlobal(size);
    try {
      Marshal.StructureToPtr(limits, buffer, false);
      if (!SetInformationJobObject(job, 9, buffer, (uint)size) ||
          !AssignProcessToJobObject(job, GetCurrentProcess())) {
        int error = Marshal.GetLastWin32Error();
        CloseHandle(job);
        throw new Win32Exception(error);
      }
      // Keep this non-inheritable handle open until the launcher exits.
    } finally { Marshal.FreeHGlobal(buffer); }
  }
}
'@
[E2EOwnedJob]::Attach()
& $env:TWM_E2E_LAUNCHER_NODE -e "eval(Buffer.from(process.env.TWM_E2E_LAUNCHER_CODE, 'base64').toString())"
[Environment]::Exit($LASTEXITCODE)
`

function spawnWindowsCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
  waitForDescendantOutput: boolean,
) {
  // Pass the original argv and environment as data, never interpolate them into
  // PowerShell or cmd source. Node retains its normal shell/argument handling.
  const environment = options.env ?? process.env
  const payload = JSON.stringify({
    command,
    args,
    options: {
      cwd: options.cwd,
      env: environment,
      shell: options.shell ?? true,
      windowsHide: options.windowsHide,
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      argv0: options.argv0,
    },
  })
  // Servers may outlive pnpm/cmd while retaining their output pipes. Finite
  // commands instead close their job when the wrapper exits, cleaning daemons.
  const runner = `
    const { spawn } = require('node:child_process');
    const { command, args, options } = ${payload};
    const child = spawn(command, args, { ...options, stdio: ['ignore', '${waitForDescendantOutput ? 'pipe' : 'inherit'}', '${waitForDescendantOutput ? 'pipe' : 'inherit'}'] });
    if (child.stdout) child.stdout.pipe(process.stdout);
    if (child.stderr) child.stderr.pipe(process.stderr);
    child.once('error', error => { console.error(error); process.exitCode = 1; });
    child.once('${waitForDescendantOutput ? 'close' : 'exit'}', code => { process.exitCode = code ?? 1; });
  `
  return spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(windowsJobLauncher, 'utf16le').toString('base64')], {
    ...options,
    shell: false,
    windowsHide: true,
    env: {
      ...environment,
      TWM_E2E_LAUNCHER_NODE: process.execPath,
      TWM_E2E_LAUNCHER_CODE: Buffer.from(runner).toString('base64'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function hasLiveProcessGroup(pid: number) {
  // An orphan can remain a zombie until init reaps it. Zombies own no sockets
  // and cannot be killed; only live members should delay successful cleanup.
  const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pgid=', '-o', 'stat='])
  return stdout.split('\n').some((line) => {
    const [group, status] = line.trim().split(/\s+/)
    return Number(group) === pid && status !== undefined && !status.startsWith('Z')
  })
}

function createCommandResult(child: ChildProcessByStdio<null, Readable, Readable>) {
  let stdout = ''
  let stderr = ''
  let exited = false
  let closed = false
  let stopping: Promise<void> | undefined

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  const wrapperExited = new Promise<void>((resolve) => {
    child.once('exit', () => {
      exited = true
      resolve()
    })
    child.once('error', () => {
      exited = true
      resolve()
    })
  })
  const completed = new Promise<CommandResult>((resolve, reject) => {
    child.once('error', (error) => {
      exited = true
      reject(error)
    })
    child.once('close', (exitCode) => {
      closed = true
      resolve({ exitCode, stdout, stderr })
    })
  })
  // Keep startup failures observable through completed without an unhandled
  // rejection while the caller is checking HTTP readiness.
  void completed.catch(() => {})

  async function signalTree(signal: NodeJS.Signals) {
    if (child.pid === undefined) {
      return
    }
    if (process.platform === 'win32') {
      if (!exited) {
        child.kill(signal)
      }
      return
    }
    try {
      process.kill(-child.pid, signal)
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ESRCH' || (code === 'EPERM' && !await hasLiveProcessGroup(child.pid))) {
        return
      }
      throw error
    }
  }

  async function waitUntilStopped(timeoutMs: number) {
    const deadline = Date.now() + timeoutMs
    do {
      const liveGroup = process.platform !== 'win32' && child.pid !== undefined
        ? await hasLiveProcessGroup(child.pid)
        : !exited
      if (closed && !liveGroup) {
        return true
      }
      await delay(25)
    } while (Date.now() < deadline)
    return false
  }

  async function stop({ gracefulTimeoutMs = 5000, forceTimeoutMs = 3000 }: StopCommandOptions = {}) {
    // The wrapper may already have exited while its server is still alive.
    await signalTree('SIGTERM')
    if (await waitUntilStopped(gracefulTimeoutMs)) {
      return
    }
    await signalTree('SIGKILL')
    if (!await waitUntilStopped(forceTimeoutMs)) {
      throw new Error(`Unable to stop owned command process tree ${child.pid ?? '(not started)'}`)
    }
  }

  return {
    get exitCode() {
      return child.exitCode
    },
    get exited() {
      return exited
    },
    stop(options?: StopCommandOptions) {
      stopping ??= stop(options).catch((error) => {
        stopping = undefined
        throw error
      })
      return stopping
    },
    completed,
    wrapperExited,
  } satisfies RunningCommand & { wrapperExited: Promise<void> }
}

function spawnOwnedCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
  waitForDescendantOutput: boolean,
) {
  const child = process.platform === 'win32'
    ? spawnWindowsCommand(command, args, options, waitForDescendantOutput)
    : spawn(command, args, {
        ...options,
        shell: options.shell ?? false,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
  return createCommandResult(child)
}

export function spawnCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
): RunningCommand {
  return spawnOwnedCommand(command, args, options, true)
}

export async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
) {
  // A finite command owns descendants only until its wrapper exits. Waiting
  // for stdout to close first can deadlock when an orphan still holds the pipe.
  const child = spawnOwnedCommand(command, args, options, false)
  try {
    await child.wrapperExited
  }
  finally {
    await child.stop()
  }
  const result = await child.completed
  if (result.exitCode !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`Command failed (${command} ${args.join(' ')}): ${output}`)
  }
  return result
}
