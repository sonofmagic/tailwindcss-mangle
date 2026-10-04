import type { TailwindTokenLocation } from '../types.ts'
import { buildLineOffsetsNative, resolveLineMetaNative, resolveLineMetasNative } from '@tailwindcss-mangle/native'
import path from 'pathe'

export const buildLineOffsets = buildLineOffsetsNative
export const resolveLineMeta = resolveLineMetaNative
export const resolveLineMetas = resolveLineMetasNative

export function toExtension(filename: string) {
  const ext = path.extname(filename).replace(/^\./, '')
  return ext || 'txt'
}

export function toRelativeFile(cwd: string, filename: string) {
  const relative = path.relative(cwd, filename)
  return relative === '' ? path.basename(filename) : relative
}

export function createTokenLocation(input: {
  cwd: string
  file: string
  content: string
  extension: string
  candidate: string
  position: number
  offsets: number[]
}): TailwindTokenLocation {
  const info = resolveLineMeta(input.content, input.offsets, input.position)
  const relativeFile = toRelativeFile(input.cwd, input.file)

  return {
    rawCandidate: input.candidate,
    file: input.file,
    relativeFile,
    extension: input.extension,
    start: input.position,
    end: input.position + input.candidate.length,
    length: input.candidate.length,
    line: info.line,
    column: info.column,
    lineText: info.lineText,
  }
}
