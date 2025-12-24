# Provider 健康状态管理改进方案

## ✅ 已实施的改进

### 改进内容
**禁用健康检查时，只有 401 认证错误才会标记 provider 为不健康**

当 `checkHealth: false` 时：
- **401 (Unauthorized)** 错误：立即标记为不健康（token 过期或无效，需要人工干预）
- 其他错误（如 403、429 限流、500 服务器错误、网络超时等）：**忽略，不记录错误**

当 `checkHealth: true` 时：
- 保持原有的错误计数机制（累计 N 次错误后标记为不健康）

### 修改的文件
1. `src/provider-pool-manager.js` - `markProviderUnhealthy()` 方法
2. `src/common.js` - `handleStreamRequest()`, `handleUnaryRequest()`, `handleModelListRequest()`
3. `src/request-handler.js` - API Service 获取失败时的错误处理

### 设计理由
- **401 错误**：表示凭证失效（token 过期或无效），需要人工干预，应立即标记为不健康
- **403 错误**：可能是临时性问题（某些 API 的限流也会返回 403），不应立即标记为不健康
- **其他错误**：可能是临时性问题（网络波动、服务器过载等），不应影响 provider 的健康状态

---

## 原始问题分析

1. **错误计数无时间衰减**：历史错误永久累积
2. **不健康状态无自动恢复**：未启用健康检查时，provider 永远无法恢复
3. **错误类型未区分**：临时错误（网络超时）和永久错误（认证失败）被同等对待

## 改进方案

### 方案 A：添加错误时间窗口（推荐）

只统计最近 N 分钟内的错误次数：

```javascript
// 在 markProviderUnhealthy 中
markProviderUnhealthy(providerType, providerConfig, errorMessage = null) {
    const provider = this._findProvider(providerType, providerConfig.uuid);
    if (!provider) return;
    
    const now = Date.now();
    const errorWindow = this.errorWindowMs || 30 * 60 * 1000; // 默认 30 分钟窗口
    
    // 初始化错误历史数组
    if (!provider.config.errorHistory) {
        provider.config.errorHistory = [];
    }
    
    // 添加新错误
    provider.config.errorHistory.push({
        time: now,
        message: errorMessage
    });
    
    // 清理窗口外的旧错误
    provider.config.errorHistory = provider.config.errorHistory.filter(
        e => (now - e.time) < errorWindow
    );
    
    // 基于窗口内的错误数判断健康状态
    if (provider.config.errorHistory.length >= this.maxErrorCount) {
        provider.config.isHealthy = false;
    }
}
```

### 方案 B：添加自动恢复机制

不健康的 provider 在一定时间后自动恢复到"待验证"状态：

```javascript
// 在 selectProvider 中添加自动恢复逻辑
selectProvider(providerType, requestedModel = null, options = {}) {
    const now = Date.now();
    const recoveryInterval = this.recoveryIntervalMs || 60 * 60 * 1000; // 默认 1 小时后可恢复
    
    // 检查不健康的 provider 是否可以恢复
    const allProviders = this.providerStatus[providerType] || [];
    for (const p of allProviders) {
        if (!p.config.isHealthy && p.config.lastErrorTime) {
            const timeSinceError = now - new Date(p.config.lastErrorTime).getTime();
            if (timeSinceError >= recoveryInterval) {
                // 重置为健康状态，但保留错误计数（下次失败会更快被标记）
                p.config.isHealthy = true;
                this._log('info', `Provider ${p.uuid} auto-recovered after ${recoveryInterval}ms`);
            }
        }
    }
    
    // 继续原有的选择逻辑...
}
```

### 方案 C：区分错误类型

根据错误类型采取不同策略：

```javascript
const ERROR_SEVERITY = {
    TEMPORARY: 'temporary',  // 网络超时、服务暂时不可用 (429, 503)
    PERMANENT: 'permanent',  // 认证失败、权限不足 (401, 403)
    UNKNOWN: 'unknown'
};

function classifyError(error) {
    const status = error.status || error.code;
    if ([429, 500, 502, 503, 504].includes(status)) {
        return ERROR_SEVERITY.TEMPORARY;
    }
    if ([401, 403].includes(status)) {
        return ERROR_SEVERITY.PERMANENT;
    }
    return ERROR_SEVERITY.UNKNOWN;
}

markProviderUnhealthy(providerType, providerConfig, error) {
    const severity = classifyError(error);
    
    if (severity === ERROR_SEVERITY.PERMANENT) {
        // 永久错误：立即标记为不健康，需要手动干预
        provider.config.isHealthy = false;
        provider.config.requiresManualRecovery = true;
    } else {
        // 临时错误：使用错误计数机制
        provider.config.errorCount++;
        if (provider.config.errorCount >= this.maxErrorCount) {
            provider.config.isHealthy = false;
        }
    }
}
```

### 方案 D：添加配置开关

让用户选择是否启用被动错误追踪：

```javascript
// provider_pools.json
{
    "gemini-cli-oauth": [
        {
            "uuid": "xxx",
            "checkHealth": false,
            "trackErrors": false  // 新增：是否追踪调用错误
        }
    ]
}
```

## 推荐实施顺序

1. **优先实施方案 A**（错误时间窗口）- 解决错误永久累积问题
2. **其次实施方案 B**（自动恢复）- 解决不健康状态无法恢复问题
3. **可选实施方案 C**（错误分类）- 更精细的错误处理
4. **可选实施方案 D**（配置开关）- 给用户更多控制权

## 配置示例

```javascript
// 新增配置项
{
    "MAX_ERROR_COUNT": 3,           // 最大错误次数
    "ERROR_WINDOW_MS": 1800000,     // 错误统计窗口（30分钟）
    "RECOVERY_INTERVAL_MS": 3600000, // 自动恢复间隔（1小时）
    "TRACK_CALL_ERRORS": true       // 是否追踪调用错误
}
