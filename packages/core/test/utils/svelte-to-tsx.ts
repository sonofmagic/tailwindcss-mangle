function extractTagContentsAndRemove(source: string, tagName: string) {
  const openToken = `<${tagName}`
  const closeToken = `</${tagName}>`
  const contents: string[] = []
  let output = ''
  let cursor = 0

  while (cursor < source.length) {
    const openIndex = source.indexOf(openToken, cursor)
    if (openIndex < 0) {
      output += source.slice(cursor)
      break
    }

    output += source.slice(cursor, openIndex)
    const tagEndIndex = source.indexOf('>', openIndex)
    if (tagEndIndex < 0) {
      output += source.slice(openIndex)
      break
    }

    const isSelfClosing = source[tagEndIndex - 1] === '/'
    if (isSelfClosing) {
      cursor = tagEndIndex + 1
      continue
    }

    const closeIndex = source.indexOf(closeToken, tagEndIndex + 1)
    if (closeIndex < 0) {
      output += source.slice(openIndex)
      break
    }

    contents.push(source.slice(tagEndIndex + 1, closeIndex))
    cursor = closeIndex + closeToken.length
  }

  return { contents, source: output }
}

function removeTagBlocks(source: string, tagName: string) {
  return extractTagContentsAndRemove(source, tagName).source
}

export function svelteToTsx(code: string) {
  try {
    const { contents: scripts, source: withoutScripts } = extractTagContentsAndRemove(code, 'script')
    const templateContent = removeTagBlocks(withoutScripts, 'style').trimStart()
    return `${scripts.join('')}\nconst render = <div>${templateContent}</div>`.trim()
  }
  catch {
    return ''
  }
}
