import fs from 'node:fs'
import path from 'pathe'
export function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, '../fixtures', caseName), 'utf8')
}
type RawSource = string | { raw: string, extension?: string }

function escapeClassName(value: string) {
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
}

function extractClassTokens(source: string) {
  const tokens = new Set<string>()
  const attrPattern = /(class|className)=(["'`])([^"'`]+)\2/g
  let match: RegExpExecArray | null
  while ((match = attrPattern.exec(source))) {
    match[3].split(/\s+/).filter(Boolean).forEach(token => tokens.add(token))
  }

  const classListPattern = /classList\.add\(([^)]+)\)/g
  while ((match = classListPattern.exec(source))) {
    const inner = match[1]
    const stringPattern = /(["'`])([^"'`]+)\1/g
    let strMatch: RegExpExecArray | null
    while ((strMatch = stringPattern.exec(inner))) {
      strMatch[2].split(/\s+/).filter(Boolean).forEach(token => tokens.add(token))
    }
  }

  return Array.from(tokens)
}

export async function getCss(raw: RawSource | RawSource[]) {
  const sources = Array.isArray(raw) ? raw : [raw]
  const classTokens = new Set<string>()

  for (const entry of sources) {
    const content = typeof entry === 'string' ? entry : entry.raw
    for (const token of extractClassTokens(content)) {
      classTokens.add(token)
    }
  }

  return Array.from(classTokens)
    .map(token => `.${escapeClassName(token)} {}`)
    .join('\n')
}
