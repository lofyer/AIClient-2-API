// Kiro AWS 批量导入模态框
import { showToast } from './utils.js';
import { t } from './i18n.js';

/**
 * 显示 Kiro AWS 批量导入模态框
 * 支持上传包含多个凭据对象的 JSON 文件
 */
export function showKiroAwsBatchImportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h3><i class="fas fa-file-upload" style="color: #8b5cf6;"></i> <span data-i18n="oauth.kiro.awsBatchImport">${t('oauth.kiro.awsBatchImport')}</span></h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="aws-batch-import-instructions" style="margin-bottom: 16px; padding: 12px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #5b21b6;">
                        <i class="fas fa-info-circle"></i>
                        <span data-i18n="oauth.kiro.awsBatchImportInstructions">${t('oauth.kiro.awsBatchImportInstructions')}</span>
                    </p>
                </div>
                
                <!-- 输入模式切换 -->
                <div class="input-mode-toggle" style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <button class="mode-btn active" data-mode="file" style="flex: 1; padding: 10px 16px; border: 2px solid #8b5cf6; border-radius: 8px; background: #f5f3ff; color: #5b21b6; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-file-upload"></i>
                        <span data-i18n="oauth.kiro.awsBatchModeFile">${t('oauth.kiro.awsBatchModeFile')}</span>
                    </button>
                    <button class="mode-btn" data-mode="json" style="flex: 1; padding: 10px 16px; border: 2px solid #d1d5db; border-radius: 8px; background: white; color: #6b7280; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-code"></i>
                        <span data-i18n="oauth.kiro.awsBatchModeJson">${t('oauth.kiro.awsBatchModeJson')}</span>
                    </button>
                </div>
                
                <!-- 文件上传模式 -->
                <div class="file-mode-section" id="fileModeSection">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                            <span data-i18n="oauth.kiro.awsBatchUploadFile">${t('oauth.kiro.awsBatchUploadFile')}</span>
                        </label>
                        <div class="aws-batch-file-upload-area" style="border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s;">
                            <input type="file" id="awsBatchFileInput" accept=".json" style="display: none;">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 36px; color: #9ca3af; margin-bottom: 8px;"></i>
                            <p style="margin: 0; color: #6b7280;" data-i18n="oauth.kiro.awsBatchDragDrop">${t('oauth.kiro.awsBatchDragDrop')}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;" data-i18n="oauth.kiro.awsBatchClickUpload">${t('oauth.kiro.awsBatchClickUpload')}</p>
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
                            <i class="fas fa-lightbulb" style="color: #8b5cf6;"></i>
                            <span data-i18n="oauth.kiro.awsBatchFileHint">${t('oauth.kiro.awsBatchFileHint')}</span>
                        </p>
                    </div>
                </div>
                
                <!-- JSON 输入模式 -->
                <div class="json-mode-section" id="jsonModeSection" style="display: none;">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                            <span data-i18n="oauth.kiro.awsBatchJsonInput">${t('oauth.kiro.awsBatchJsonInput')}</span>
                        </label>
                        <textarea 
                            id="awsBatchJsonInput" 
                            rows="12" 
                            style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-family: monospace; font-size: 13px; resize: vertical;"
                            placeholder="${t('oauth.kiro.awsBatchJsonPlaceholder')}"
                            data-i18n-placeholder="oauth.kiro.awsBatchJsonPlaceholder"
                        ></textarea>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
                            <i class="fas fa-lightbulb" style="color: #8b5cf6;"></i>
                            <span data-i18n="oauth.kiro.awsBatchJsonHint">${t('oauth.kiro.awsBatchJsonHint')}</span>
                        </p>
                    </div>
                    <details style="margin-bottom: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <summary style="padding: 12px; cursor: pointer; font-weight: 600; color: #374151; user-select: none;">
                            <i class="fas fa-code" style="color: #8b5cf6; margin-right: 8px;"></i>
                            <span data-i18n="oauth.kiro.awsBatchJsonExample">${t('oauth.kiro.awsBatchJsonExample')}</span>
                        </summary>
                        <pre style="margin: 0; padding: 12px; background: #1f2937; color: #10b981; border-radius: 0 0 8px 8px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre;">[
  {
    "clientId": "VYZBSTx3Q7QEq1W3Wn8c5nVzLWVhc3QtMQ",
    "clientSecret": "eyJraWQi...OAMc",
    "accessToken": "aoaAAAAAGlgghoSqRgQK...2tfhmdNZDA",
    "refreshToken": "aorAAAAAGn...uKw+E3",
    "region": "us-east-1"
  },
  {
    "clientId": "AnotherClientId123",
    "clientSecret": "eyJraWQi...xyz",
    "accessToken": "aoaAAAAAGlgghoSqRgQK...abc",
    "refreshToken": "aorAAAAAGn...def",
    "region": "us-east-1"
  }
]</pre>
                    </details>
                </div>
                
                <div class="aws-batch-validation-result" id="awsBatchValidationResult" style="display: none; margin-bottom: 16px; padding: 12px; border-radius: 8px;"></div>
                
                <div class="aws-batch-progress" id="awsBatchProgress" style="display: none; margin-top: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-spinner fa-spin" style="color: #8b5cf6;"></i>
                        <span data-i18n="oauth.kiro.importing">${t('oauth.kiro.importing')}</span>
                    </div>
                    <div class="progress-bar" style="margin-top: 8px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                        <div id="awsBatchProgressBar" style="height: 100%; width: 0%; background: #8b5cf6; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <div class="aws-batch-result" id="awsBatchResult" style="display: none; margin-top: 16px; padding: 12px; border-radius: 8px;"></div>
            </div>
            <div class="modal-footer">
                <button class="modal-cancel" data-i18n="modal.provider.cancel">${t('modal.provider.cancel')}</button>
                <button class="btn btn-primary aws-batch-import-submit" id="awsBatchImportSubmit" disabled>
                    <i class="fas fa-upload"></i>
                    <span data-i18n="oauth.kiro.startImport">${t('oauth.kiro.startImport')}</span>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const fileInput = modal.querySelector('#awsBatchFileInput');
    const uploadArea = modal.querySelector('.aws-batch-file-upload-area');
    const validationResult = modal.querySelector('#awsBatchValidationResult');
    const progressDiv = modal.querySelector('#awsBatchProgress');
    const progressBar = modal.querySelector('#awsBatchProgressBar');
    const resultDiv = modal.querySelector('#awsBatchResult');
    const submitBtn = modal.querySelector('#awsBatchImportSubmit');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const modeBtns = modal.querySelectorAll('.mode-btn');
    const fileModeSection = modal.querySelector('#fileModeSection');
    const jsonModeSection = modal.querySelector('#jsonModeSection');
    const jsonInputTextarea = modal.querySelector('#awsBatchJsonInput');
    
    let credentialsList = null;
    let currentMode = 'file';
    
    // 模式切换
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode === currentMode) return;
            
            currentMode = mode;
            
            // 更新按钮样式
            modeBtns.forEach(b => {
                if (b.dataset.mode === mode) {
                    b.style.borderColor = '#8b5cf6';
                    b.style.background = '#f5f3ff';
                    b.style.color = '#5b21b6';
                    b.classList.add('active');
                } else {
                    b.style.borderColor = '#d1d5db';
                    b.style.background = 'white';
                    b.style.color = '#6b7280';
                    b.classList.remove('active');
                }
            });
            
            // 切换显示区域
            if (mode === 'file') {
                fileModeSection.style.display = 'block';
                jsonModeSection.style.display = 'none';
            } else {
                fileModeSection.style.display = 'none';
                jsonModeSection.style.display = 'block';
            }
            
            // 重置状态
            validationResult.style.display = 'none';
            submitBtn.disabled = true;
            credentialsList = null;
        });
    });
    
    // JSON 输入实时验证
    jsonInputTextarea.addEventListener('input', () => {
        validateJsonInput();
    });
    
    // 验证 JSON 输入
    function validateJsonInput() {
        const inputValue = jsonInputTextarea.value.trim();
        
        if (!inputValue) {
            validationResult.style.display = 'none';
            submitBtn.disabled = true;
            credentialsList = null;
            return;
        }
        
        try {
            const parsed = JSON.parse(inputValue);
            credentialsList = Array.isArray(parsed) ? parsed : [parsed];
            
            // 验证每个凭据对象
            const validationErrors = [];
            credentialsList.forEach((cred, index) => {
                const missing = [];
                if (!cred.clientId) missing.push('clientId');
                if (!cred.clientSecret) missing.push('clientSecret');
                if (!cred.accessToken) missing.push('accessToken');
                if (!cred.refreshToken) missing.push('refreshToken');
                
                if (missing.length > 0) {
                    validationErrors.push(`Credential ${index + 1}: missing ${missing.join(', ')}`);
                }
            });
            
            if (validationErrors.length > 0) {
                validationResult.style.cssText = 'display: block; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;';
                validationResult.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t('oauth.kiro.awsValidationFailed')}</strong>
                    </div>
                    <ul style="margin: 8px 0 0 24px; font-size: 12px;">
                        ${validationErrors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                `;
                submitBtn.disabled = true;
            } else {
                validationResult.style.cssText = 'display: block; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;';
                validationResult.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle"></i>
                        <strong>${t('oauth.kiro.awsValidationSuccess')}</strong>
                        <span style="font-weight: normal;">(${credentialsList.length} ${t('oauth.kiro.credentials')})</span>
                    </div>
                `;
                submitBtn.disabled = false;
            }
        } catch (error) {
            validationResult.style.cssText = 'display: block; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;';
            validationResult.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>${t('oauth.kiro.awsJsonParseError')}</strong>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px;">${error.message}</p>
            `;
            submitBtn.disabled = true;
            credentialsList = null;
        }
    }
    
    // 文件上传区域交互
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#8b5cf6';
        uploadArea.style.background = '#f5f3ff';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#d1d5db';
        uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#d1d5db';
        uploadArea.style.background = 'transparent';
        
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            processFile(fileInput.files[0]);
        }
    });
    
    // 处理上传的文件
    async function processFile(file) {
        try {
            const content = await readFileAsText(file);
            const parsed = JSON.parse(content);
            credentialsList = Array.isArray(parsed) ? parsed : [parsed];
            
            // 验证每个凭据对象
            const validationErrors = [];
            credentialsList.forEach((cred, index) => {
                const missing = [];
                if (!cred.clientId) missing.push('clientId');
                if (!cred.clientSecret) missing.push('clientSecret');
                if (!cred.accessToken) missing.push('accessToken');
                if (!cred.refreshToken) missing.push('refreshToken');
                
                if (missing.length > 0) {
                    validationErrors.push(`Credential ${index + 1}: missing ${missing.join(', ')}`);
                }
            });
            
            if (validationErrors.length > 0) {
                validationResult.style.cssText = 'display: block; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;';
                validationResult.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t('oauth.kiro.awsValidationFailed')}</strong>
                    </div>
                    <ul style="margin: 8px 0 0 24px; font-size: 12px;">
                        ${validationErrors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                `;
                submitBtn.disabled = true;
            } else {
                validationResult.style.cssText = 'display: block; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;';
                validationResult.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle"></i>
                        <strong>${t('oauth.kiro.awsValidationSuccess')}</strong>
                        <span style="font-weight: normal;">(${credentialsList.length} ${t('oauth.kiro.credentials')})</span>
                    </div>
                `;
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Failed to parse file:', error);
            validationResult.style.cssText = 'display: block; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;';
            validationResult.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>${t('oauth.kiro.awsJsonParseError')}</strong>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px;">${error.message}</p>
            `;
            submitBtn.disabled = true;
            credentialsList = null;
        }
    }
    
    // 读取文件为文本
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    // 关闭按钮事件
    [closeBtn, cancelBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });
    
    // 提交按钮事件 - 使用 SSE 流式响应实时显示进度
    submitBtn.addEventListener('click', async () => {
        if (!credentialsList || credentialsList.length === 0) {
            showToast(t('common.warning'), t('oauth.kiro.noCredentials'), 'warning');
            return;
        }
        
        // 禁用输入和按钮
        if (currentMode === 'json') {
            jsonInputTextarea.disabled = true;
        } else {
            fileInput.disabled = true;
        }
        submitBtn.disabled = true;
        cancelBtn.disabled = true;
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        progressBar.style.width = '0%';
        
        // 创建实时结果显示区域
        resultDiv.style.cssText = 'display: block; margin-top: 16px; padding: 12px; border-radius: 8px; background: #f3f4f6; border: 1px solid #d1d5db;';
        resultDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <i class="fas fa-spinner fa-spin" style="color: #8b5cf6;"></i>
                <strong id="awsBatchProgressText">${t('oauth.kiro.importingProgress', { current: 0, total: credentialsList.length })}</strong>
            </div>
            <div id="awsBatchResultsList" style="max-height: 200px; overflow-y: auto; font-size: 12px; margin-top: 8px;"></div>
        `;
        
        const progressText = resultDiv.querySelector('#awsBatchProgressText');
        const resultsList = resultDiv.querySelector('#awsBatchResultsList');
        
        let successCount = 0;
        let failedCount = 0;
        
        try {
            // 使用 fetch + SSE 获取流式响应
            const response = await fetch('/api/kiro/batch-import-aws-credentials', {
                method: 'POST',
                headers: window.apiClient ? window.apiClient.getAuthHeaders() : {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ credentials: credentialsList })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // 解析 SSE 事件
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                let eventType = '';
                let eventData = '';
                
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.substring(7).trim();
                    } else if (line.startsWith('data: ')) {
                        eventData = line.substring(6).trim();
                        
                        if (eventType && eventData) {
                            try {
                                const data = JSON.parse(eventData);
                                
                                if (eventType === 'start') {
                                    console.log(`[AWS Batch Import] Starting import of ${data.total} credentials`);
                                } else if (eventType === 'progress') {
                                    const { index, total, current, successCount: sc, failedCount: fc } = data;
                                    successCount = sc;
                                    failedCount = fc;
                                    
                                    // 更新进度条
                                    const percentage = Math.round((index / total) * 100);
                                    progressBar.style.width = `${percentage}%`;
                                    
                                    // 更新进度文本
                                    progressText.textContent = t('oauth.kiro.importingProgress', { current: index, total: total });
                                    
                                    // 添加结果项
                                    const resultItem = document.createElement('div');
                                    resultItem.style.cssText = 'padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.1);';
                                    
                                    if (current.success) {
                                        resultItem.innerHTML = `Credential ${current.index}: <span style="color: #166534;">✓ ${current.path}</span>`;
                                    } else if (current.error === 'duplicate') {
                                        resultItem.innerHTML = `Credential ${current.index}: <span style="color: #d97706;">⚠ ${t('oauth.kiro.duplicateCredential')}</span>
                                            ${current.existingPath ? `<span style="color: #666; font-size: 11px;">(${current.existingPath})</span>` : ''}`;
                                    } else {
                                        resultItem.innerHTML = `Credential ${current.index}: <span style="color: #991b1b;">✗ ${current.error}</span>`;
                                    }
                                    
                                    resultsList.appendChild(resultItem);
                                    resultsList.scrollTop = resultsList.scrollHeight;
                                    
                                } else if (eventType === 'complete') {
                                    progressBar.style.width = '100%';
                                    progressDiv.style.display = 'none';
                                    
                                    const isAllSuccess = data.failedCount === 0;
                                    const isAllFailed = data.successCount === 0;
                                    
                                    let resultClass, resultIcon, resultMessage;
                                    if (isAllSuccess) {
                                        resultClass = 'background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;';
                                        resultIcon = 'fa-check-circle';
                                        resultMessage = t('oauth.kiro.importSuccess', { count: data.successCount });
                                    } else if (isAllFailed) {
                                        resultClass = 'background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;';
                                        resultIcon = 'fa-times-circle';
                                        resultMessage = t('oauth.kiro.importAllFailed', { count: data.failedCount });
                                    } else {
                                        resultClass = 'background: #fffbeb; border: 1px solid #fde68a; color: #92400e;';
                                        resultIcon = 'fa-exclamation-triangle';
                                        resultMessage = t('oauth.kiro.importPartial', { success: data.successCount, failed: data.failedCount });
                                    }
                                    
                                    resultDiv.style.cssText = `display: block; margin-top: 16px; padding: 12px; border-radius: 8px; ${resultClass}`;
                                    
                                    const headerDiv = resultDiv.querySelector('div:first-child');
                                    headerDiv.innerHTML = `<i class="fas ${resultIcon}"></i> <strong>${resultMessage}</strong>`;
                                    
                                    // 更新按钮文本为"完成"
                                    submitBtn.innerHTML = `<i class="fas fa-check"></i> <span data-i18n="oauth.kiro.importCompleted">${t('oauth.kiro.importCompleted')}</span>`;
                                    
                                    // 刷新提供商列表
                                    if (data.successCount > 0) {
                                        // 触发自定义事件通知主页面刷新
                                        window.dispatchEvent(new CustomEvent('kiro-credentials-updated'));
                                    }
                                    
                                } else if (eventType === 'error') {
                                    throw new Error(data.error);
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse SSE data:', parseError);
                            }
                            
                            eventType = '';
                            eventData = '';
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('[AWS Batch Import] Failed:', error);
            progressDiv.style.display = 'none';
            resultDiv.style.cssText = 'display: block; margin-top: 16px; padding: 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;';
            resultDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-times-circle"></i>
                    <strong>${t('oauth.kiro.importError')}: ${error.message}</strong>
                </div>
            `;
        } finally {
            // 重新启用按钮
            if (currentMode === 'json') {
                jsonInputTextarea.disabled = false;
            } else {
                fileInput.disabled = false;
            }
            submitBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    });
}
