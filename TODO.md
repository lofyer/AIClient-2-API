# TODO

## 代理功能

### 已完成
- [x] 全局代理配置（config.json 中的 GLOBAL_PROXY）
- [x] 代理工具函数（proxy-utils.js）
- [x] 支持的提供商：
  - OpenAI Custom
  - Claude Custom
  - Claude Kiro OAuth
  - Qwen OAuth
  - OpenAI Responses
- [x] UI：高级设置中的代理配置（类型、地址、端口）
- [x] UI：提供商详情中的"启用代理/禁用代理"按钮

### 待完成
- [ ] 补充 Gemini CLI 和 Antigravity 的代理支持
  - 需要将模块级 httpsAgent 改为实例级
  - OAuth 刷新和模型请求都会走代理
