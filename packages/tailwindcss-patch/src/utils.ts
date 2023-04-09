import fs from 'fs'

export function ensureFileContent(filepaths: string | string[]) {
  if (typeof filepaths === 'string') {
    filepaths = [filepaths]
  }
  let content
  for (let i = 0; i < filepaths.length; i++) {
    const filepath = filepaths[i]
    if (fs.existsSync(filepath)) {
      content = fs.readFileSync(filepath, {
        encoding: 'utf-8'
      })
      break
    }
  }
  return content
}
