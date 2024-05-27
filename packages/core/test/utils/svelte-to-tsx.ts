/* eslint-disable @typescript-eslint/no-unused-vars */

import MagicString from 'magic-string'

/** @see https://github.com/sveltejs/svelte/blob/d3297e2a2595db08c85356d65fd5f953b04a681f/packages/svelte/src/compiler/preprocess/index.js#L255C1-L255C85 */
const regex_style_tags = /<!--[\s\S]*?-->|<style(\s[\s\S]*?)?(?:>([\s\S]*?)<\/style>|\/>)/gi

/** @see https://github.com/sveltejs/svelte/blob/d3297e2a2595db08c85356d65fd5f953b04a681f/packages/svelte/src/compiler/preprocess/index.js#L256C1-L256C88 */
const regex_script_tags = /<!--[\s\S]*?-->|<script(\s[\s\S]*?)?(?:>([\s\S]*?)<\/script>|\/>)/gi

export function svelteToTsx(code: string) {
  try {
    const scripts = []
    const original = new MagicString(code)

    // Remove script tags & extract script content
    let match: RegExpExecArray | null
    while ((match = regex_script_tags.exec(code)) != null) {
      const [fullMatch, _attributesStr, scriptContent] = match
      if (scriptContent) {
        scripts.push(scriptContent)
        original.remove(match.index, match.index + fullMatch.length)
      }
    }

    const templateContent = original.toString().trimStart().replaceAll(regex_style_tags, '').replaceAll(regex_style_tags, '')
    const transformed = `${scripts.join('')}\nconst render = <div>${templateContent}</div>`

    return transformed.toString().trim()
  }
  catch {
    return ''
  }
}
