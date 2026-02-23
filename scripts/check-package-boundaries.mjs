#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
])

const FROM_SPECIFIER_RE = /\bfrom\s*['"]([^'"]+)['"]/g
const BARE_IMPORT_SPECIFIER_RE = /\bimport\s*['"]([^'"]+)['"]/g
const DYNAMIC_SPECIFIER_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const REQUIRE_SPECIFIER_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const VUE_OR_SVELTE_EXTENSIONS = new Set(['.vue', '.svelte'])

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']

const SHARED_BANNED_IO_MODULES = new Set([
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:child_process',
  'node:net',
  'node:tls',
  'node:http',
  'node:https',
  'node:worker_threads',
  'fs',
  'fs/promises',
  'path',
  'child_process',
  'net',
  'tls',
  'http',
  'https',
  'worker_threads',
  'fs-extra',
  'pathe',
])

/**
 * Package dependency boundary policies.
 * `allowedInternal` is a strict allow-list of cross-workspace package edges.
 */
const RULES = {
  '@tailwindcss-mangle/shared': {
    allowedInternal: [],
    disallowedSpecifiers: ['tailwindcss-patch', 'tailwindcss-patch/', 'unplugin-tailwindcss-mangle', 'unplugin-tailwindcss-mangle/'],
  },
  '@tailwindcss-mangle/config': {
    allowedInternal: ['@tailwindcss-mangle/shared'],
    disallowedSpecifiers: ['unplugin-tailwindcss-mangle', 'unplugin-tailwindcss-mangle/'],
  },
  '@tailwindcss-mangle/core': {
    allowedInternal: ['@tailwindcss-mangle/config', '@tailwindcss-mangle/shared'],
    disallowedSpecifiers: ['tailwindcss-patch', 'tailwindcss-patch/'],
  },
  'unplugin-tailwindcss-mangle': {
    allowedInternal: ['@tailwindcss-mangle/core', '@tailwindcss-mangle/config', '@tailwindcss-mangle/shared'],
    disallowedSpecifiers: ['tailwindcss-patch', 'tailwindcss-patch/'],
  },
  'tailwindcss-patch': {
    allowedInternal: ['@tailwindcss-mangle/config', '@tailwindcss-mangle/shared'],
    disallowedSpecifiers: ['unplugin-tailwindcss-mangle', 'unplugin-tailwindcss-mangle/', '@tailwindcss-mangle/core', '@tailwindcss-mangle/core/'],
  },
}

const traverse = _traverse.default ?? _traverse

function normalizeSpecifier(specifier) {
  return specifier.trim()
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')
}

function isSourceFile(filePath) {
  if (filePath.endsWith('.d.ts') || filePath.endsWith('.d.mts') || filePath.endsWith('.d.cts')) {
    return false
  }
  return SOURCE_EXTENSIONS.has(path.extname(filePath))
}

function isSharedNodeIoSpecifier(specifier) {
  const normalized = specifier.startsWith('node:') ? specifier : specifier
  if (SHARED_BANNED_IO_MODULES.has(normalized)) {
    return true
  }
  if (specifier.startsWith('node:fs/') || specifier.startsWith('node:path/')) {
    return true
  }
  if (specifier.startsWith('fs/') || specifier.startsWith('path/')) {
    return true
  }
  return false
}

function matchesDisallowedSpecifier(specifier, disallowedSpecifiers) {
  return disallowedSpecifiers.some((disallowed) => {
    if (disallowed.endsWith('/')) {
      return specifier.startsWith(disallowed)
    }
    return specifier === disallowed
  })
}

function resolveInternalPackage(specifier, internalPackageNames) {
  for (const packageName of internalPackageNames) {
    if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
      return packageName
    }
  }
  return null
}

function extractSpecifiersWithRegex(code) {
  const specifiers = []
  for (const regex of [FROM_SPECIFIER_RE, BARE_IMPORT_SPECIFIER_RE, DYNAMIC_SPECIFIER_RE, REQUIRE_SPECIFIER_RE]) {
    regex.lastIndex = 0
    let match = regex.exec(code)
    while (match !== null) {
      const specifier = normalizeSpecifier(match[1] ?? '')
      if (!specifier) {
        match = regex.exec(code)
        continue
      }
      const line = code.slice(0, match.index).split('\n').length
      specifiers.push({ line, specifier })
      match = regex.exec(code)
    }
  }
  return specifiers
}

function getBabelPlugins(filePath) {
  const ext = path.extname(filePath)
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
    return ['typescript']
  }
  if (ext === '.tsx') {
    return ['typescript', 'jsx']
  }
  if (ext === '.jsx') {
    return ['jsx']
  }
  return []
}

function extractSpecifiersWithAst(code, filePath) {
  const specifiers = []
  const ast = parse(code, {
    sourceType: 'unambiguous',
    plugins: getBabelPlugins(filePath),
    errorRecovery: true,
  })

  const pushSpecifier = (sourceValue, line) => {
    if (typeof sourceValue !== 'string' || sourceValue.trim().length === 0) {
      return
    }
    specifiers.push({
      line: line ?? 1,
      specifier: normalizeSpecifier(sourceValue),
    })
  }

  traverse(ast, {
    ImportDeclaration(astPath) {
      pushSpecifier(astPath.node.source.value, astPath.node.loc?.start.line)
    },
    ExportNamedDeclaration(astPath) {
      if (astPath.node.source) {
        pushSpecifier(astPath.node.source.value, astPath.node.loc?.start.line)
      }
    },
    ExportAllDeclaration(astPath) {
      pushSpecifier(astPath.node.source.value, astPath.node.loc?.start.line)
    },
    ImportExpression(astPath) {
      const firstArg = astPath.node.source
      if (firstArg?.type === 'StringLiteral') {
        pushSpecifier(firstArg.value, astPath.node.loc?.start.line)
      }
    },
    CallExpression(astPath) {
      const { callee, arguments: args } = astPath.node
      if (callee.type === 'Import' && args[0]?.type === 'StringLiteral') {
        pushSpecifier(args[0].value, astPath.node.loc?.start.line)
        return
      }
      if (callee.type === 'Identifier' && callee.name === 'require' && args[0]?.type === 'StringLiteral') {
        pushSpecifier(args[0].value, astPath.node.loc?.start.line)
      }
    },
  })

  return specifiers
}

function extractSpecifiers(code, filePath) {
  const ext = path.extname(filePath)
  if (VUE_OR_SVELTE_EXTENSIONS.has(ext)) {
    return extractSpecifiersWithRegex(code)
  }
  try {
    return extractSpecifiersWithAst(code, filePath)
  }
  catch {
    return extractSpecifiersWithRegex(code)
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function collectSourceFiles(dirPath) {
  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath))
      continue
    }
    if (entry.isFile() && isSourceFile(fullPath)) {
      files.push(fullPath)
    }
  }
  return files
}

async function collectWorkspacePackages(packagesDir) {
  const entries = await fs.readdir(packagesDir, { withFileTypes: true })
  const pkgInfos = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const pkgRoot = path.join(packagesDir, entry.name)
    const packageJsonPath = path.join(pkgRoot, 'package.json')
    try {
      const packageJson = await readJson(packageJsonPath)
      if (typeof packageJson.name === 'string' && packageJson.name.length > 0) {
        pkgInfos.push({
          dirName: entry.name,
          packageJson,
          packageJsonPath,
          root: pkgRoot,
          srcRoot: path.join(pkgRoot, 'src'),
        })
      }
    }
    catch {
      continue
    }
  }
  return pkgInfos
}

function collectDependencyViolations(pkg, rule, internalPackageNames, violations) {
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg.packageJson[field]
    if (!deps || typeof deps !== 'object') {
      continue
    }
    for (const depName of Object.keys(deps)) {
      if (matchesDisallowedSpecifier(depName, rule.disallowedSpecifiers)) {
        violations.push({
          packageName: pkg.packageJson.name,
          location: path.relative(process.cwd(), pkg.packageJsonPath),
          message: `disallowed dependency "${depName}" in ${field}`,
        })
      }
      const internalTarget = resolveInternalPackage(depName, internalPackageNames)
      if (!internalTarget) {
        continue
      }
      if (!rule.allowedInternal.includes(internalTarget)) {
        violations.push({
          packageName: pkg.packageJson.name,
          location: path.relative(process.cwd(), pkg.packageJsonPath),
          message: `internal dependency "${depName}" in ${field} is outside allow-list`,
        })
      }
    }
  }
}

async function collectImportViolations(pkg, rule, internalPackageNames, violations) {
  const sourceFiles = await collectSourceFiles(pkg.srcRoot)
  let scannedFiles = 0
  for (const filePath of sourceFiles) {
    scannedFiles += 1
    const code = await fs.readFile(filePath, 'utf8')
    const specifiers = extractSpecifiers(code, filePath)
    for (const { line, specifier } of specifiers) {
      if (isRelativeSpecifier(specifier)) {
        continue
      }
      if (matchesDisallowedSpecifier(specifier, rule.disallowedSpecifiers)) {
        violations.push({
          packageName: pkg.packageJson.name,
          location: `${path.relative(process.cwd(), filePath)}:${line}`,
          message: `disallowed import "${specifier}"`,
        })
      }
      if (pkg.packageJson.name === '@tailwindcss-mangle/shared' && isSharedNodeIoSpecifier(specifier)) {
        violations.push({
          packageName: pkg.packageJson.name,
          location: `${path.relative(process.cwd(), filePath)}:${line}`,
          message: `shared must stay runtime-agnostic; avoid Node I/O import "${specifier}"`,
        })
      }
      const internalTarget = resolveInternalPackage(specifier, internalPackageNames)
      if (!internalTarget) {
        continue
      }
      if (!rule.allowedInternal.includes(internalTarget)) {
        violations.push({
          packageName: pkg.packageJson.name,
          location: `${path.relative(process.cwd(), filePath)}:${line}`,
          message: `import "${specifier}" crosses restricted package boundary`,
        })
      }
    }
  }
  return scannedFiles
}

async function main() {
  const repoRoot = process.cwd()
  const packagesDir = path.join(repoRoot, 'packages')
  const packages = await collectWorkspacePackages(packagesDir)
  const internalPackageNames = packages
    .map(pkg => pkg.packageJson.name)
    .sort((a, b) => b.length - a.length)

  const violations = []
  let scannedFiles = 0
  let checkedPackages = 0

  for (const pkg of packages) {
    const rule = RULES[pkg.packageJson.name]
    if (!rule) {
      continue
    }
    checkedPackages += 1
    collectDependencyViolations(pkg, rule, internalPackageNames, violations)
    scannedFiles += await collectImportViolations(pkg, rule, internalPackageNames, violations)
  }

  if (violations.length > 0) {
    console.error(`Boundary check failed with ${violations.length} violation(s):`)
    for (const violation of violations) {
      console.error(`- [${violation.packageName}] ${violation.location}: ${violation.message}`)
    }
    process.exit(1)
  }

  console.log(`Boundary check passed. Checked ${checkedPackages} package(s), scanned ${scannedFiles} source file(s).`)
}

await main()
