---
"tailwindcss-patch": minor
---

新增 `splitCandidateTokens` 同步候选 token 分割 API，用于在 JS、WXML 等源码片段中识别 Tailwind 候选 token。

该 API 支持单引号和双引号包裹的 arbitrary value，并在 malformed arbitrary value 场景下避免吞掉后续 token。
