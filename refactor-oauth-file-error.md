# OAuth 凭据文件路径错误处理重构计划

## 问题背景

当前代码中存在不合理的默认凭据路径 fallback，导致：
1. 日志输出误导性信息（如 `[Kiro Auth] Attempting to load credentials from directory: ~/.aws/sso/cache`）
2. 当凭据文件不存在时，错误信息不够明确

## 现状分析

所有 OAuth 凭据上传后都保存在 `configs/xxx/` 目录，路径记录在 `provider_pools.json` 的 `XXX_OAUTH_CREDS_FILE_PATH` 字段。即使是 BASE64 或 TEXT 方式上传，最终也会转换为文件保存。

### 当前各文件的默认 fallback 路径

| 文件 | 行号 | 当前默认路径 | 问题 |
|------|------|-------------|------|
| `src/claude/claude-kiro.js` | 281 | `~/.aws/sso/cache` | 完全不合理，与保存路径无关 |
| `src/gemini/gemini-core.js` | 264 | `~/.gemini` | 与 oauth-handlers 一致但不应作为 fallback |
| `src/openai/qwen-core.js` | 377, 682 | `~/.qwen` | 与 oauth-handlers 一致但不应作为 fallback |

## 修复方案

### 阶段一：修复错误处理（优先）

#### 1. claude/claude-kiro.js

**修改位置：** 第 281 行及 `initializeAuth` 方法

```javascript
// 修改前
this.credPath = config.KIRO_OAUTH_CREDS_DIR_PATH || path.join(os.homedir(), ".aws", "sso", "cache");

// 修改后
this.credPath = config.KIRO_OAUTH_CREDS_DIR_PATH || null;
```

在 `initializeAuth` 中增加检查：
```javascript
if (!useBase64OrTextCreds) {
    if (!this.credsFilePath && !this.credPath) {
        throw new Error('[Kiro] 未配置凭据文件路径，请通过 UI 上传凭据或授权');
    }
    const targetFilePath = this.credsFilePath || path.join(this.credPath, KIRO_AUTH_TOKEN_FILE);
    
    // 检查文件是否存在
    try {
        await fs.access(targetFilePath);
    } catch {
        throw new Error(`[Kiro] 凭据文件不存在: ${targetFilePath}，请检查路径或重新上传`);
    }
    // ... 继续原有逻辑
}
```

#### 2. gemini/gemini-core.js

**修改位置：** 第 264 行及 `initializeAuth` 方法

```javascript
// 修改前
const credPath = this.oauthCredsFilePath || path.join(os.homedir(), CREDENTIALS_DIR, CREDENTIALS_FILE);

// 修改后
if (!this.oauthCredsFilePath && !this.oauthCredsBase64 && !this.oauthCredsText) {
    throw new Error('[Gemini] 未配置凭据来源，请通过 UI 上传凭据或授权');
}
const credPath = this.oauthCredsFilePath;
if (!credPath) {
    // 如果是 Base64 或 Text 方式，走原有逻辑
    // ...
}

// 检查文件是否存在
try {
    await fs.access(credPath);
} catch {
    throw new Error(`[Gemini] 凭据文件不存在: ${credPath}，请检查路径或重新上传`);
}
```

#### 3. openai/qwen-core.js

**修改位置：** `_getQwenCachedCredentialPath` 方法（第 373-378 行）及第 682 行

```javascript
// 修改前
_getQwenCachedCredentialPath() {
    if (this.config && this.config.QWEN_OAUTH_CREDS_FILE_PATH) {
        return path.resolve(this.config.QWEN_OAUTH_CREDS_FILE_PATH);
    }
    return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
}

// 修改后
_getQwenCachedCredentialPath() {
    if (this.config && this.config.QWEN_OAUTH_CREDS_FILE_PATH) {
        return path.resolve(this.config.QWEN_OAUTH_CREDS_FILE_PATH);
    }
    return null; // 不再返回默认路径
}
```

在使用该方法的地方增加检查：
```javascript
const credPath = this._getQwenCachedCredentialPath();
if (!credPath) {
    throw new Error('[Qwen] 未配置凭据文件路径，请通过 UI 上传凭据或授权');
}

// 检查文件是否存在
try {
    await fs.access(credPath);
} catch {
    throw new Error(`[Qwen] 凭据文件不存在: ${credPath}，请检查路径或重新上传`);
}
```

### 阶段二：清理冗余代码（后续）

由于 BASE64 和 TEXT 方式上传后都会转换为 FILE_PATH，可以考虑清理以下冗余代码：

1. **claude/claude-kiro.js**
   - 移除 `KIRO_OAUTH_CREDS_BASE64` 相关处理（第 299-309 行）
   - 移除 `KIRO_OAUTH_CREDS_TEXT` 相关处理（第 310-318 行）
   - 移除 `this.credsBase64`、`this.credsText`、`this.base64Creds` 变量

2. **gemini/gemini-core.js**
   - 移除 `GEMINI_OAUTH_CREDS_BASE64` 相关处理
   - 移除 `GEMINI_OAUTH_CREDS_TEXT` 相关处理

3. **config-manager.js**
   - 保留命令行参数支持（向后兼容）
   - 但内部处理时统一转换为 FILE_PATH

4. **ui-manager.js**
   - 清理 BASE64/TEXT 相关的配置字段处理

## 测试要点

1. 未配置任何凭据时，启动服务应报明确错误
2. 配置了不存在的文件路径时，应报明确错误
3. 配置了正确的文件路径时，应正常工作
4. provider_pools.json 中的节点路径不存在时，该节点应标记为不健康并报错

## 相关文件

- `src/claude/claude-kiro.js`
- `src/gemini/gemini-core.js`
- `src/openai/qwen-core.js`
- `src/oauth-handlers.js`（保存逻辑，无需修改）
- `src/provider-pool-manager.js`（健康检查逻辑，可能需要增强）
- `src/config-manager.js`（配置解析）
- `src/ui-manager.js`（UI 配置处理）
