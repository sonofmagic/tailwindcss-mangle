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

# 迁移已废弃的配置字段（预览模式）
pnpm dlx tw-patch migrate --dry-run

# 基于迁移报告中的备份快照恢复配置（预览模式）
pnpm dlx tw-patch restore --report-file .tw-patch/migrate-report.json --dry-run

# 仅校验迁移报告兼容性（不写回文件）
pnpm dlx tw-patch validate --report-file .tw-patch/migrate-report.json --json
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

### `migrate` 常用参数

| 参数              | 说明                                   |
| ----------------- | -------------------------------------- |
| `--cwd <dir>`     | 指定扫描配置文件时的工作目录。         |
| `--config <file>` | 仅迁移指定的配置文件。                 |
| `--workspace`     | 递归扫描 workspace 下的配置文件。      |
| `--max-depth <n>` | `--workspace` 模式下的最大递归深度（默认 `6`）。 |
| `--include <glob>` | 仅迁移匹配该 glob 的文件（可重复传参）。 |
| `--exclude <glob>` | 跳过匹配该 glob 的文件（可重复传参）。 |
| `--report-file <file>` | 把迁移报告写入 JSON 文件。         |
| `--backup-dir <dir>` | 把迁移前的原始文件备份到指定目录。   |
| `--check`         | CI 检查模式，若仍有文件需要迁移则报错退出。 |
| `--json`          | 输出 JSON 格式的迁移报告。             |
| `--dry-run`       | 仅预览将要变更的内容，不写入磁盘。     |

`tw-patch migrate` 会扫描目标目录下的 `tailwindcss-patch.config.*` 和 `tailwindcss-mangle.config.*`。开启 `--workspace` 后会递归扫描子项目（会跳过 `node_modules`、`.git`、`dist` 等目录），可通过 `--include` / `--exclude` 控制扫描范围，并把已废弃字段改写为现代字段（例如 `registry.output` -> `registry.extract`、`registry.tailwind` -> `registry.tailwindcss`），同时输出逐文件摘要。

迁移写入默认采用“事务式”策略：如果后续文件写入失败，会自动回滚此前已经写入的迁移文件，避免留下半迁移状态。若需要显式保留原始文件快照，可配合 `--backup-dir`；若需要审计产物，可配合 `--report-file`。

迁移报告现在会携带元数据：`reportKind`、`schemaVersion`、`generatedAt` 和 `tool`（`name` / `version`），便于恢复阶段做兼容性校验。

### `restore` 常用参数

| 参数                   | 说明                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `--cwd <dir>`          | 指定恢复时使用的工作目录。                                   |
| `--report-file <file>` | 指定迁移报告路径（默认 `.tw-patch/migrate-report.json`）。   |
| `--dry-run`            | 仅预览恢复目标，不执行写入。                                 |
| `--strict`             | 报告中的备份文件缺失时直接报错退出。                         |
| `--json`               | 输出 JSON 格式的恢复结果。                                   |

`tw-patch restore` 在报告包含元数据时会执行 schema 校验。若 `reportKind` 不匹配或 `schemaVersion` 高于当前支持版本，会拒绝恢复；不包含该元数据的历史报告仍保持兼容。
使用 `--json` 时，恢复结果会在报告含元数据时附带 `reportKind` / `reportSchemaVersion` 字段。

### `validate` 常用参数

| 参数                   | 说明                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `--cwd <dir>`          | 指定校验时使用的工作目录。                                   |
| `--report-file <file>` | 指定迁移报告路径（默认 `.tw-patch/migrate-report.json`）。   |
| `--strict`             | 报告中的备份文件缺失时直接报错退出。                         |
| `--json`               | 输出 JSON 格式的校验结果。                                   |

`tw-patch validate` 会以 dry-run 模式执行迁移报告校验，不写回任何恢复文件，同时校验报告 schema 与备份引用状态。

迁移报告 JSON Schema 通过子路径发布：`tailwindcss-patch/migration-report.schema.json`。
编程场景也可直接从包入口导入报告相关导出：
`migrateConfigFiles`、`restoreConfigFiles`、`MIGRATION_REPORT_KIND`、`MIGRATION_REPORT_SCHEMA_VERSION`、`ConfigFileMigrationReport`。

### `tokens` 常用参数

| 参数                                   | 说明                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| `--cwd <dir>`                          | 指定扫描时使用的工作目录。                                  |
| `--output <file>`                      | 覆盖输出文件路径（默认 `.tw-patch/tw-token-report.json`）。 |
| `--format <json\|lines\|grouped-json>` | 选择 JSON（默认）、按行输出，或按文件路径分组的 JSON。      |
| `--group-key <relative\|absolute>`     | 分组 JSON 的键（默认使用相对路径）。                        |
| `--no-write`                           | 只打印预览，不写入磁盘。                                    |

## 编程接口

```ts
import { TailwindcssPatcher } from 'tailwindcss-patch'

const patcher = new TailwindcssPatcher({
  projectRoot: process.cwd(),
  cache: {
    enabled: true,
    dir: '.tw-patch/cache',
    strategy: 'merge',
    driver: 'file',
  },
  extract: {
    write: true,
    file: '.tw-patch/tw-class-list.json',
    format: 'json',
  },
  apply: {
    overwrite: true,
    exposeContext: { refProperty: 'runtimeContexts' },
    extendLengthUnits: {
      units: ['rpx'],
    },
  },
  tailwindcss: {
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

构造函数既可以接收上述新版对象，也可以传入旧结构；内部会自动完成兼容转换。

已标记弃用（下一个大版本移除）的旧字段：`cwd`、`overwrite`、`tailwind`、`features`、`output`。

字段迁移关系：
- `cwd` -> `projectRoot`
- `overwrite` -> `apply.overwrite`
- `tailwind` -> `tailwindcss`
- `features` -> `apply`
- `output` -> `extract`

当运行时检测到这些旧字段时，`normalizeOptions` 会输出一次性告警，帮助你逐步迁移。

当遇到文件权限受限等情况时，可通过 cache.driver 切换为默认的文件缓存、内存缓存（memory）或无操作模式（noop）。

### 缓存治理（schema v2）

`tailwindcss-patch` 现在通过 **上下文指纹（context fingerprint）** 做缓存隔离，避免 monorepo 多项目互相污染。

- 缓存文件升级为索引结构（`schemaVersion: 2`），按 context 分区存储。
- 缓存命中同时要求指纹与 metadata 一致。
- 旧版数组缓存会被安全读取并按 miss 处理，后续写入时惰性重建。
- 写入采用“锁文件 + 临时文件原子 rename”，降低并发写坏索引的风险。

指纹组成：

- realpath 规范化后的 `process.cwd()`
- realpath 规范化后的 project root / cache cwd
- Tailwind config 绝对路径（若存在）+ mtime
- Tailwind 包 root + version
- `tailwindcss-patch` 自身版本
- 关键 patch options 的稳定序列化哈希（排序键，结果 deterministic）

指纹只在 `TailwindcssPatcher` 构造阶段计算一次，并在后续缓存读写中复用。

### 显式清理缓存

```ts
// 默认只清理当前 context
const current = await patcher.clearCache()
// => { scope: 'current', filesRemoved, entriesRemoved, contextsRemoved }

// 清理索引中的全部 context
const all = await patcher.clearCache({ scope: 'all' })
```

调试可观测性：

- 命中日志包含 fingerprint 与 schema 信息
- 失效日志包含原因和细项（配置/版本/路径/options 变化）

### 可复用工具

- `normalizeOptions`：归一化用户输入并应用默认值。
- `CacheStore`：读写类名缓存（支持文件、内存或 noop 驱动），可选择合并或覆盖策略。
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
  registry: {
    projectRoot: '.',
    extract: {
      file: '.tw-patch/tw-class-list.json',
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
    apply: {
      overwrite: true,
      exposeContext: true,
      extendLengthUnits: {
        units: ['rpx'],
      },
    },
  },
})
```

`defineConfig` 同时支持现代 `registry` 字段（`projectRoot`、`tailwindcss`、`apply`、`extract`）和旧字段。两者同时存在时，patcher 归一化会优先采用现代字段。

## 迁移

从 7.x 或更早版本升级时，请阅读 [MIGRATION.md](./MIGRATION.md) 获取模块调整和 API 变化说明。

## License

MIT © ice breaker
