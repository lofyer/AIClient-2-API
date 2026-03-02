// Kiro 批量导入 AWS 凭据功能
import { importAwsCredentials } from './kiro-oauth.js';
import logger from '../utils/logger.js';

/**
 * 批量导入 AWS 凭据（支持数组或单个对象）
 * @param {Array|Object} credentialsInput - 凭据数组或单个凭据对象
 * @param {Function} onProgress - 进度回调函数
 * @param {boolean} skipDuplicateCheck - 是否跳过重复检查
 * @returns {Promise<Object>} 批量处理结果
 */
export async function batchImportAwsCredentials(credentialsInput, onProgress = null, skipDuplicateCheck = false) {
    // 统一处理为数组
    const credentialsList = Array.isArray(credentialsInput) ? credentialsInput : [credentialsInput];
    
    const results = {
        total: credentialsList.length,
        success: 0,
        failed: 0,
        details: []
    };
    
    logger.info(`[Kiro Batch AWS Import] Starting batch import of ${credentialsList.length} credentials`);
    
    for (let i = 0; i < credentialsList.length; i++) {
        const credentials = credentialsList[i];
        const progressData = {
            index: i + 1,
            total: credentialsList.length,
            current: null
        };
        
        try {
            // 验证凭据对象
            if (!credentials || typeof credentials !== 'object') {
                throw new Error('Invalid credentials object');
            }
            
            // 调用单个导入函数
            const result = await importAwsCredentials(credentials, skipDuplicateCheck);
            
            if (result.success) {
                progressData.current = {
                    index: i + 1,
                    success: true,
                    path: result.path
                };
                results.success++;
            } else {
                progressData.current = {
                    index: i + 1,
                    success: false,
                    error: result.error,
                    existingPath: result.existingPath
                };
                results.failed++;
            }
            
        } catch (error) {
            logger.error(`[Kiro Batch AWS Import] Failed to import credential ${i + 1}:`, error);
            progressData.current = {
                index: i + 1,
                success: false,
                error: error.message
            };
            results.failed++;
        }
        
        results.details.push(progressData.current);
        
        // 发送进度更新
        if (onProgress) {
            await onProgress({
                ...progressData,
                successCount: results.success,
                failedCount: results.failed
            });
        }
    }
    
    logger.info(`[Kiro Batch AWS Import] Completed: ${results.success} success, ${results.failed} failed`);
    
    return results;
}
