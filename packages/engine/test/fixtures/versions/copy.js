import fs from 'node:fs/promises'
import path from 'pathe'

import { copyFiles, ensureDir, getCurrentFilename, pathExists } from './utils.js'
function getTailwindcssVersion(str) {
  // eslint-disable-next-line no-useless-escape
  const match = /^tailwindcss([\d\.]*)$/.exec(str)
  if (match === null) {
    // 不是 tailwindcss
    return false
  } else if (match[1] === '') {
    return 'lts'
  } else {
    return match[1]
  }
}

const relativePaths = [
  'package.json', 'lib/index.js', 'lib/plugin.js', 'lib/processTailwindFeatures.js', 'lib/util/dataTypes.js',
  'lib/jit/index.js', 'lib/jit/processTailwindFeatures.js'
]
// async function copyTargetFile() {

// }

async function main() {
  const filename = getCurrentFilename(import.meta.url)
  const dirname = path.dirname(filename)
  const nodeModulesPath = path.resolve(dirname, 'node_modules')
  const packageJsonPath = path.resolve(dirname, 'package.json')

  if (!(await pathExists(nodeModulesPath))) {
    console.warn('[versions] node_modules directory not found. Run `yarn install` inside fixtures/versions first.')
    return
  }

  const filenames = await fs.readdir(nodeModulesPath)
  const pkgJson = await fs.readFile(packageJsonPath, 'utf8').then(res => JSON.parse(res))
  const dependencies = pkgJson.dependencies ?? {}
  const entries = Object.entries(dependencies)

  if (entries.length === 0) {
    console.warn('[versions] No dependencies found in fixtures/versions package.json.')
    return
  }

  for (let i = 0; i < entries.length; i++) {
    const [localPkgName] = entries[i]

    const version = getTailwindcssVersion(localPkgName)
    if (version && filenames.includes(localPkgName)) {
      const targetDir = path.resolve(dirname, version)
      await ensureDir(targetDir)
      await copyFiles(relativePaths.map(x => {
        return {
          src: path.resolve(nodeModulesPath, localPkgName, x),
          dest: path.resolve(targetDir, x)
        }
      }))
    } else if (version) {
      console.warn(`[versions] Package ${localPkgName} is listed but not installed. Re-run install.js for ${version}.`)
    }
  }

  console.log('[versions] TailwindCSS snapshots updated.')
}

main()
