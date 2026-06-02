---
"tailwindcss-patch": patch
---

修复发布包 `dist` 入口没有导出 `splitCandidateTokens`、`isValidCandidateToken` 和 `validateCandidateTokenRE` 的问题，并收敛源码入口与发布入口的公共 API 导出。

此前源码入口已经导出这些 API，但构建入口 `src/index.bundle.ts` 漏导出，导致 npm 包的 CommonJS/ESM/类型入口无法消费同步候选 token 分割能力。

现在公共导出统一从 `src/public-api.ts` 维护，`src/index.bundle.ts` 只保留 CLI 懒加载适配；同时删除重复的 `src/cli.bundle.ts`，由 `src/cli.ts` 作为唯一 CLI 启动入口。
