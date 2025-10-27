# tailwindcss-patch

重新设计的 Tailwind CSS 补丁工具，用于导出运行时上下文、扫描 v4 的类候选、并在同一个入口管理缓存与输出。新的架构提供更清晰的配置体验，同时完全兼容旧版配置文件。

- 自动为 Tailwind v2/v3 打补丁，暴露运行时上下文，不再手动修改源码。
- 针对 Tailwind v4，通过扫描 CSS 和内容源生成完整类名清单。
- 支持写入 JSON 或纯文本文件，也可以仅在内存中返回结果，方便集成到自定义流程。
- 集中式配置：缓存策略、过滤器、自定义长度单位都可以在一个对象里完成。

## 安装

```bash
pnpm add -D tailwindcss-patch
pnpm dlx tw-patch install
```

为了在安装依赖时自动保持补丁，可添加 `prepare` 脚本：

```json
{
  "scripts": {
    "prepare": "tw-patch install"
  }
}
```

## CLI 使用

在项目根目录通过 `tw-patch`（或 `tailwindcss-patch`）运行命令：

```bash
# 为当前安装的 Tailwind 应用补丁
pnpm dlx tw-patch install

# 生成类名清单到配置的输出文件
pnpm dlx tw-patch extract

# 扫描项目，导出包含文件/位置的 Tailwind token
pnpm dlx tw-patch tokens --format lines
```

### `extract` 常用参数

| 参数                     | 说明                                   |
| ------------------------ | -------------------------------------- |
| `--cwd <dir>`            | 指定读取配置的工作目录。               |
| `--output <file>`        | 覆盖输出文件路径。                     |
| `--format <json\|lines>` | 切换 JSON（默认）或换行分隔的纯文本。  |
| `--css <file>`           | 使用 Tailwind v4 时指定 CSS 入口文件。 |
| `--no-write`             | 仅返回结果，不落盘。                   |

CLI 会通过 `@tailwindcss-mangle/config` 加载 `tailwindcss-patch.config.ts`。旧配置仍可使用，详情请参考 [迁移指南](./MIGRATION.md)。

### `tokens` 常用参数

| 参数                     | 说明                                            |
| ------------------------ | ----------------------------------------------- |
| `--cwd <dir>`            | 指定扫描时使用的工作目录。                      |
| `--output <file>`        | 覆盖输出文件路径（默认 `.tw-patch/tw-token-report.json`）。 |
| `--format <json\|lines\|grouped-json>` | 选择 JSON（默认）、按行输出，或按文件路径分组的 JSON。 |
| `--group-key <relative\|absolute>` | 分组 JSON 的键（默认使用相对路径）。 |
| `--no-write`             | 只打印预览，不写入磁盘。                        |

## 编程接口

```ts
import { TailwindcssPatcher } from 'tailwindcss-patch'

const patcher = new TailwindcssPatcher({
  overwrite: true,
  cache: {
    enabled: true,
    dir: '.tw-patch/cache',
    strategy: 'merge',
  },
  output: {
    file: '.tw-patch/tw-class-list.json',
    format: 'json',
  },
  features: {
    exposeContext: { refProperty: 'runtimeContexts' },
    extendLengthUnits: {
      units: ['rpx'],
    },
  },
  tailwind: {
    version: 4,
    v4: {
      base: './src',
      cssEntries: ['dist/tailwind.css'],
    },
  },
})

await patcher.patch()
const { classList, filename } = await patcher.extract()
const tokenReport = await patcher.collectContentTokens()
console.log(tokenReport.entries[0])
const groupedTokens = await patcher.collectContentTokensByFile()
console.log(groupedTokens['src/button.tsx'][0].rawCandidate)
// 如果需要保留绝对路径：
// await patcher.collectContentTokensByFile({ key: 'absolute', stripAbsolutePaths: false })
```

构造函数既可以接收上述新版对象，也可以传入旧的 `patch`/`cache` 结构；内部会自动完成兼容转换。

### 可复用工具

- `normalizeOptions`：归一化用户输入并应用默认值。
- `CacheStore`：读写类名缓存，支持合并或覆盖策略。
- `extractProjectCandidatesWithPositions`：扫描内容源并返回带位置的 Tailwind token 信息。
- `groupTokensByFile`：将 token 报告转换为 `{ [filePath]: TailwindTokenLocation[] }` 形式。
- `extractValidCandidates`：利用 Tailwind Oxide 扫描 v4 CSS 与内容源。
- `runTailwindBuild`：在 v2/v3 项目中运行 Tailwind PostCSS 插件以预热上下文。

以上工具均由包入口导出，便于集成到自定义流程。

## 配置示例

```ts
// tailwindcss-patch.config.ts
import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  patch: {
    output: {
      filename: '.tw-patch/tw-class-list.json',
      removeUniversalSelector: true,
      format: 'json',
    },
    tailwindcss: {
      version: 4,
      v4: {
        cssEntries: ['dist/tailwind.css'],
        sources: [{ base: 'src', pattern: '**/*.{html,tsx}', negated: false }],
      },
    },
    applyPatches: {
      exportContext: true,
      extendLengthUnits: {
        units: ['rpx'],
      },
    },
  },
})
```

虽然 `defineConfig` 仍然暴露旧的字段名，但所有新增字段都会被自动识别并归一化。

## 迁移

从 7.x 或更早版本升级时，请阅读 [MIGRATION.md](./MIGRATION.md) 获取模块调整和 API 变化说明。

## License

MIT © ice breaker
