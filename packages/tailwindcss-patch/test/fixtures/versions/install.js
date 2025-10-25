import { execa } from 'execa'
import { fileURLToPath } from 'node:url'

const versions = process.argv.slice(2).map(arg => arg.trim()).filter(Boolean)
const workspaceRoot = fileURLToPath(new URL('.', import.meta.url))

if (!versions.length) {
  console.error('[versions] Expected at least one Tailwind CSS version, e.g. `node install.js 3.4.18`.')
  process.exitCode = 1
} else {
  try {
    for (const version of versions) {
      await installVersion(version)
    }
    console.log('[versions] Installation complete.')
  } catch (error) {
    console.error('[versions] Failed to install requested version(s).')
    console.error(error)
    process.exitCode = 1
  }
}

function normalizeVersion(version) {
  if (!version) {
    throw new Error('Version must be a non-empty string.')
  }

  const trimmed = version.trim()
  if (trimmed === 'lts' || trimmed === 'latest') {
    return {
      display: 'tailwindcss@latest',
      spec: 'tailwindcss',
    }
  }

  const withoutPrefix = trimmed.replace(/^tailwindcss/i, '').replace(/^v/, '')
  if (!withoutPrefix) {
    throw new Error(`Unable to determine Tailwind CSS version from "${version}".`)
  }

  const alias = `tailwindcss${withoutPrefix}`
  return {
    display: `tailwindcss@${withoutPrefix}`,
    spec: `${alias}@npm:tailwindcss@${withoutPrefix}`,
  }
}

async function installVersion(version) {
  const { display, spec } = normalizeVersion(version)
  console.log(`[versions] Installing ${display} via yarn…`)
  const child = execa('yarn', ['add', spec], {
    cwd: workspaceRoot,
    stdio: 'pipe',
  })

  child.stdout?.pipe(process.stdout)
  child.stderr?.pipe(process.stderr)

  await child
}
