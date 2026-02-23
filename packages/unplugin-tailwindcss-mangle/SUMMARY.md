# unplugin-tailwindcss-mangle 包总结

## 核心定位

这是一个 **unplugin 插件包**，用于在构建过程中将 Tailwind CSS 类名进行混淆压缩，支持 Vite、Webpack、Rollup、ESBuild、Nuxt 等主流构建工具。

## 架构设计

### 三阶段插件架构

1. **`:pre` 阶段** - 初始化配置和过滤器
2. **主阶段** - 文件转换（CSS/JS/HTML）
3. **`:post` 阶段** - 后处理，生成映射文件

### 目录结构

```
src/
├── core/           # 核心模块
│   ├── factory.ts  # 插件工厂（三阶段生命周期管理）
│   └── plugin.ts   # unplugin 包装器
├── vite.ts         # Vite 集成
├── webpack.ts      # Webpack 集成
├── rollup.ts       # Rollup 集成
├── esbuild.ts      # ESBuild 集成
├── nuxt.ts         # Nuxt 3 集成
├── loader.ts       # Webpack 自定义 loader
├── utils.ts        # 工具函数
├── constants.ts    # 常量定义
└── types.ts        # 类型导出
```

## 核心依赖

| 依赖包                       | 用途                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| `@tailwindcss-mangle/core`   | 提供 `cssHandler`、`jsHandler`、`htmlHandler` 转换引擎和 `Context` 类 |
| `@tailwindcss-mangle/config` | 配置管理                                                              |
| `@tailwindcss-mangle/shared` | 共享工具和默认过滤器                                                  |
| `unplugin`                   | 跨构建工具插件框架                                                    |
| `@rollup/pluginutils`        | Rollup 插件工具（文件过滤）                                           |
| `magic-string`               | 字符串操作工具                                                        |
| `is-css-request`             | CSS 请求检测                                                          |

## 文件处理流程

```
文件 → 过滤器 → 扩展名识别 → 分发到对应处理器
  ↓
├── .js/.ts/.jsx/.tsx → jsHandler
├── .css            → cssHandler
├── .html           → htmlHandler
└── .vue/.svelte    → 智能识别 CSS/JS 部分分别处理
```

## 各构建工具集成特点

| 工具        | 集成方式                                                     |
| ----------- | ------------------------------------------------------------ |
| **Vite**    | `transformInclude` + `transform` + `transformIndexHtml`      |
| **Webpack** | 注入自定义 loader（在 postcss-loader 之前）+ `processAssets` |
| **Rollup**  | unplugin 自动适配                                            |
| **ESBuild** | unplugin 自动适配                                            |
| **Nuxt**    | 作为模块集成，需设置 `experimental.inlineSSRStyles: false`   |

## 关键设计特点

1. **三阶段架构** - 确保配置正确初始化、文件正确转换、映射正确生成
2. **文件类型智能识别** - 自动处理不同文件类型和框架（Vue、Svelte）
3. **构建工具原生集成** - 每个构建工具都有特定的优化实现
4. **安全转换策略** - 只转换包含 `-` 或 `:` 的类名，避免误转换普通词汇
5. **缓存支持** - 使用 `.cache` 目录缓存中间结果，提高构建性能
6. **类型安全** - 完整的 TypeScript 类型定义和导出

## 导出结构

```json
{
  ".": "./dist/index.js", // 主入口
  "./vite": "./dist/vite.js", // Vite 专用入口
  "./webpack": "./dist/webpack.js", // Webpack 专用入口
  "./rollup": "./dist/rollup.js", // Rollup 专用入口
  "./esbuild": "./dist/esbuild.js", // ESBuild 专用入口
  "./nuxt": "./dist/nuxt.js" // Nuxt 专用入口
}
```

## 使用流程

1. 安装依赖：`unplugin-tailwindcss-mangle` + `tailwindcss-patch`
2. 运行安装脚本：`npx tw-patch install`
3. 提取类名：`npx tw-patch extract`（生成 `.tw-patch/tw-class-list.json`）
4. 配置插件：在构建工具中配置插件（只在生产环境生效）
5. 构建项目：运行构建命令，类名会被混淆

## 总结

这个包是整个项目的**构建集成层**，负责将核心转换能力适配到各种构建工具中。通过 unplugin 的统一接口，实现了跨构建工具的兼容性，同时针对每个工具的特性进行了优化。
