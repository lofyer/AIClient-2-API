# TODO

## 代理功能

### 已完成
- [x] 全局代理配置（config.json 中的 GLOBAL_PROXY）
- [x] 代理工具函数（proxy-utils.js）
- [x] UI：高级设置中的代理配置（类型、地址、端口）
- [x] UI：提供商详情中的"启用代理/禁用代理"按钮

### 各提供商代理支持完成度

| 提供商 | 请求模型 | 刷新OAuth | 用量查询 | 备注 |
|--------|----------|-----------|----------|------|
| OpenAI Custom | ✅ | N/A | N/A | 使用 API Key，无需刷新 |
| OpenAI Responses | ✅ | N/A | N/A | 使用 API Key，无需刷新 |
| Claude Custom | ✅ | N/A | N/A | 使用 API Key，无需刷新 |
| Claude Kiro OAuth | ✅ | ✅ | ✅ | 全部走 `this.axiosInstance`，代理生效 |
| Qwen OAuth | ✅ | ❌ | N/A | OAuth 刷新使用 `fetch()`，不走代理 |
| Gemini CLI | ❌ | ❌ | ❌ | 使用模块级 agent，暂不支持 |
| Antigravity | ❌ | ❌ | ❌ | 使用模块级 agent，暂不支持 |

### 待完成
- [ ] 修复 Qwen OAuth 刷新不走代理的问题
  - `qwen-core.js` 中的 `commonFetch` 函数使用原生 `fetch()`，不走 axios 代理
  - 需要改用 axios 或为 fetch 配置代理 agent
- [ ] 补充 Gemini CLI 和 Antigravity 的代理支持
  - 需要将模块级 `httpsAgent` 改为实例级
  - 修改 `OAuth2Client` 的 `transporterOptions.agent` 为动态创建
