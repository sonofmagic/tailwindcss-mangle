import process from 'node:process'
import { config } from 'dotenv'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import OpenAI from 'openai'
import path from 'pathe'

config(
  {
    path: path.resolve(import.meta.dirname, '../.env'),
  },
)
const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

async function getAiContent(content: string) {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一个中英文翻译专家，将用户输入的中文翻译成英文，或将用户输入的英文翻译成中文。对于非中文内容，它将提供中文翻译结果。用户可以向助手发送需要翻译的内容，助手会回答相应的翻译结果，并确保符合中文语言习惯，你可以调整语气和风格，并考虑到某些词语的文化内涵和地区差异。同时作为翻译家，需将原文翻译成具有信达雅标准的译文。"信" 即忠实于原文的内容与意图；"达" 意味着译文应通顺易懂，表达清晰；"雅" 则追求译文的文化审美和语言的优美。目标是创作出既忠于原作精神，又符合目标语言文化和读者审美的翻译。你接受的字符串格式为 markdown 或者 mdx 格式，请确保输出的 markdown 符合 markdown 格式，同时不要把结果包裹在```markdown 代码块中 ',
        },
        {
          role: 'user',
          content,
        },
      ],
      // deepseek-reasoner
      model: 'deepseek-chat',
    })
    return completion?.choices?.[0]?.message.content
  }
  catch (error) {
    console.warn(error)
  }
}

async function main() {
  const contentDir = path.resolve(import.meta.dirname, '../content')
  const zhDir = path.resolve(contentDir, './zh')
  const output = await new Fdir().withFullPaths().glob('**/*.mdx', '**/*.md').crawl(
    zhDir,
  ).withPromise()
  const res = await Promise.all(
    output.map(async (x) => {
      return {
        absPath: x,
        relPath: path.relative(zhDir, x),
        source: await fs.readFile(x, 'utf8'),
      }
    }),
  )
  const ppp = await Promise.allSettled(
    res.map(async (x) => {
      return {
        ...x,
        result: await getAiContent(x.source),
      }
    }),
  )
  for (const pp of ppp) {
    if (pp.status === 'fulfilled' && pp.value.result) {
      let xx = pp.value.result
      if (xx.startsWith('```markdown')) {
        xx = xx.split('\n').slice(1, -1).join('\n')
      }
      fs.writeFile(path.resolve(contentDir, './en', pp.value.relPath), xx)
    }
  }
  console.log('done')
}

main()
