# 批量上传 Kiro Auth JSON 功能计划

## 功能概述

在 `claude-kiro-oauth` 提供商管理 Modal 中，在"添加新提供商"按钮左侧增加一个"批量上传"按钮，支持用户一次性上传多个 `kiro-auth-token.json` 凭据文件。

## 当前状态

### 现有 UI 结构 (modal.js)
```javascript
<div class="provider-summary-actions">
    <button id="toggleAllProxyBtn">启用/禁用代理</button>
    <button onclick="showAddProviderForm()">添加新提供商</button>  // 在此按钮左侧添加
    <button onclick="resetAllProvidersHealth()">重置为健康</button>
    <button onclick="performHealthCheck()">健康检测</button>
</div>
```

### 现有批量功能参考
- `upload-config-manager.js` 中的 `batchLinkProviderConfigs()` - 批量关联已存在的配置
- 单文件上传已有实现：`uploadCredentialsAsFile()` in `utils.js`

## 实现计划

### 1. 前端修改

#### 1.1 修改 `static/app/modal.js`

**位置**: `showProviderManagerModal()` 函数中的 `provider-summary-actions` 区域

**添加按钮**:
```javascript
// 仅对 claude-kiro-oauth 类型显示批量上传按钮
${providerType === 'claude-kiro-oauth' ? `
    <button class="btn btn-primary" onclick="window.showBatchUploadKiroModal('${providerType}')" title="批量上传多个 kiro-auth-token.json 文件">
        <i class="fas fa-upload"></i> 批量上传
    </button>
` : ''}
<button class="btn btn-success" onclick="window.showAddProviderForm('${providerType}')">
    <i class="fas fa-plus"></i> 添加新提供商
</button>
```

#### 1.2 新增批量上传 Modal

**新增函数**: `showBatchUploadKiroModal(providerType)`

功能:
- 显示文件选择对话框，支持多选 (`multiple` 属性)
- 接受 `.json` 文件
- 显示已选文件列表预览
- 提供上传进度反馈

```javascript
function showBatchUploadKiroModal(providerType) {
    // 创建隐藏的 file input，支持多选
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        // 确认对话框
        if (!confirm(`确定要上传 ${files.length} 个 Kiro 凭据文件吗？`)) return;
        
        // 批量上传处理
        await batchUploadKiroCredentials(files, providerType);
    };
    
    input.click();
}
```

#### 1.3 批量上传处理函数

**新增函数**: `batchUploadKiroCredentials(files, providerType)`

```javascript
async function batchUploadKiroCredentials(files, providerType) {
    showToast(`正在上传 ${files.length} 个凭据文件...`, 'info');
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const file of files) {
        try {
            // 验证 JSON 格式
            const content = await file.text();
            const json = JSON.parse(content);
            
            // 验证必要字段 (accessToken 或 clientId+clientSecret)
            if (!json.accessToken && !(json.clientId && json.clientSecret)) {
                throw new Error('缺少必要的认证字段');
            }
            
            // 调用现有上传 API
            const formData = new FormData();
            formData.append('file', file);
            formData.append('providerType', providerType);
            
            await window.apiClient.upload('/upload-credentials', formData);
            successCount++;
        } catch (error) {
            failCount++;
            errors.push(`${file.name}: ${error.message}`);
        }
    }
    
    // 显示结果
    if (failCount === 0) {
        showToast(`成功上传 ${successCount} 个凭据文件`, 'success');
    } else {
        showToast(`上传完成: 成功 ${successCount} 个, 失败 ${failCount} 个`, 'warning');
        console.error('上传失败详情:', errors);
    }
    
    // 刷新提供商列表
    await refreshProviderModal(providerType);
}
```

### 2. 后端修改 (如需要)

#### 2.1 检查现有 API

检查 `/upload-credentials` API 是否支持:
- 自动生成唯一文件名 (避免覆盖)
- 自动创建 `configs/kiro/` 目录结构
- 自动关联到号池

如果现有 API 已支持，则无需后端修改。

#### 2.2 可选: 新增批量上传 API

如果需要优化性能，可新增 `/batch-upload-credentials` API:
- 接受多个文件
- 单次事务处理
- 返回批量结果

### 3. 样式修改

#### 3.1 修改 `static/app/styles.css`

```css
.btn-batch-upload {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
}

.btn-batch-upload:hover {
    background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
    transform: translateY(-1px);
}

.btn-batch-upload i {
    margin-right: 5px;
}
```

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `static/app/modal.js` | 添加批量上传按钮、`showBatchUploadKiroModal()`、`batchUploadKiroCredentials()` |
| `static/app/styles.css` | 添加批量上传按钮样式 |

## 用户流程

1. 用户打开 `claude-kiro-oauth` 提供商管理 Modal
2. 点击"批量上传"按钮
3. 系统弹出文件选择对话框 (支持多选)
4. 用户选择多个 `kiro-auth-token.json` 文件
5. 系统显示确认对话框，列出文件数量
6. 用户确认后，系统逐个上传并验证
7. 上传完成后显示结果统计
8. 自动刷新提供商列表，显示新添加的账号

## 注意事项

1. **文件验证**: 上传前验证 JSON 格式和必要字段
2. **文件命名**: 使用时间戳+原文件名避免冲突
3. **错误处理**: 单个文件失败不影响其他文件上传
4. **进度反馈**: 大量文件时显示上传进度
5. **安全性**: 仅接受 `.json` 文件，限制文件大小

## 扩展考虑

- 支持拖拽上传
- 支持 ZIP 压缩包批量导入
- 支持从剪贴板粘贴 JSON 内容
- 支持其他 OAuth 提供商的批量上传 (gemini-cli-oauth 等)
