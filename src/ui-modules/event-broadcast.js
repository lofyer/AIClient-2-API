import { existsSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import multer from 'multer';
import logger from '../utils/logger.js';

// Token存储到本地文件中
const TOKEN_STORE_FILE = path.join(process.cwd(), 'configs', 'token-store.json');

// 用量缓存文件路径
const USAGE_CACHE_FILE = path.join(process.cwd(), 'configs', 'usage-cache.json');

/**
 * Helper function to broadcast events to UI clients
 * @param {string} eventType - The type of event
 * @param {any} data - The data to broadcast
 */
export function broadcastEvent(eventType, data) {
    if (global.eventClients && global.eventClients.length > 0) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        global.eventClients.forEach(client => {
            client.write(`event: ${eventType}\n`);
            client.write(`data: ${payload}\n\n`);
        });
    }
}

/**
 * Server-Sent Events for real-time updates
 */
export async function handleEvents(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write('\n');

    // Store the response object for broadcasting
    if (!global.eventClients) {
        global.eventClients = [];
    }
    global.eventClients.push(res);

    // Keep connection alive
    const keepAlive = setInterval(() => {
        res.write(':\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAlive);
        global.eventClients = global.eventClients.filter(r => r !== res);
    });

    return true;
}

/**
 * Initialize UI management features
 */
export function initializeUIManagement() {
    // Initialize log broadcasting for UI
    if (!global.eventClients) {
        global.eventClients = [];
    }
    if (!global.logBuffer) {
        global.logBuffer = [];
    }

    // Override console.log to broadcast logs
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: args.map(arg => {
                if (typeof arg === 'string') return arg;
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }).join(' ')
        };
        global.logBuffer.push(logEntry);
        if (global.logBuffer.length > 100) {
            global.logBuffer.shift();
        }
        broadcastEvent('log', logEntry);
    };

    // Override console.error to broadcast errors
    const originalError = console.error;
    console.error = function(...args) {
        originalError.apply(console, args);
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: args.map(arg => {
                if (typeof arg === 'string') return arg;
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }).join(' ')
        };
        global.logBuffer.push(logEntry);
        if (global.logBuffer.length > 100) {
            global.logBuffer.shift();
        }
        broadcastEvent('log', logEntry);
    };
}

// 配置multer中间件
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            // multer在destination回调时req.body还未解析，先使用默认路径
            // 实际的provider会在文件上传完成后从req.body中获取
            const uploadPath = path.join(process.cwd(), 'configs', 'temp');
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${sanitizedName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.json', '.txt', '.key', '.pem', '.p12', '.pfx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB限制
    }
});

// 多文件上传配置
export const uploadMultiple = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB限制
        files: 10 // 最多10个文件
    }
});

/**
 * 处理 OAuth 凭据文件上传（支持单文件和多文件）
 * @param {http.IncomingMessage} req - HTTP 请求对象
 * @param {http.ServerResponse} res - HTTP 响应对象
 * @param {Object} options - 可选配置
 * @param {Object} options.providerMap - 提供商类型映射表
 * @param {string} options.logPrefix - 日志前缀
 * @param {string} options.userInfo - 用户信息（用于日志）
 * @param {Object} options.customUpload - 自定义 multer 实例
 * @returns {Promise<boolean>} 始终返回 true 表示请求已处理
 */
export function handleUploadOAuthCredentials(req, res, options = {}) {
    const {
        providerMap = {},
        logPrefix = '[UI API]',
        userInfo = '',
        customUpload = null
    } = options;
    
    // 先尝试解析是否为多文件上传
    const uploadMiddleware = customUpload 
        ? customUpload.array('files', 10) 
        : uploadMultiple.array('files', 10);
    
    return new Promise((resolve) => {
        uploadMiddleware(req, res, async (err) => {
            // 如果多文件上传失败，尝试单文件上传
            if (err || (!req.files || req.files.length === 0)) {
                // 回退到单文件上传
                const singleUploadMiddleware = customUpload 
                    ? customUpload.single('file') 
                    : upload.single('file');
                
                singleUploadMiddleware(req, res, async (singleErr) => {
                    if (singleErr) {
                        logger.error(`${logPrefix} File upload error:`, singleErr.message);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: {
                                message: singleErr.message || 'File upload failed'
                            }
                        }));
                        resolve(true);
                        return;
                    }
                    
                    // 处理单文件上传
                    await handleSingleFileUpload(req, res, options, resolve);
                });
                return;
            }

            // 处理多文件上传
            await handleMultipleFilesUpload(req, res, options, resolve);
        });
    });
}

/**
 * 处理单文件上传
 */
async function handleSingleFileUpload(req, res, options, resolve) {
    const {
        providerMap = {},
        logPrefix = '[UI API]',
        userInfo = ''
    } = options;
    
    try {
        if (!req.file) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'No file was uploaded'
                }
            }));
            resolve(true);
            return;
        }

        // multer执行完成后，表单字段已解析到req.body中
        const providerType = req.body.provider || 'common';
        // 应用提供商映射（如果有）
        const provider = providerMap[providerType] || providerType;
        const tempFilePath = req.file.path;
        
        // 根据实际的provider移动文件到正确的目录
        let targetDir = path.join(process.cwd(), 'configs', provider);
        
        // 如果是kiro类型的凭证，需要再包裹一层文件夹
        if (provider === 'kiro') {
            // 使用时间戳作为子文件夹名称，确保每个上传的文件都有独立的目录
            const timestamp = Date.now();
            const originalNameWithoutExt = path.parse(req.file.originalname).name;
            const subFolder = `${timestamp}_${originalNameWithoutExt}`;
            targetDir = path.join(targetDir, subFolder);
        }
        
        await fs.mkdir(targetDir, { recursive: true });
        
        const targetFilePath = path.join(targetDir, req.file.filename);
        await fs.rename(tempFilePath, targetFilePath);
        
        const relativePath = path.relative(process.cwd(), targetFilePath);

        // 广播更新事件
        broadcastEvent('config_update', {
            action: 'add',
            filePath: relativePath,
            provider: provider,
            timestamp: new Date().toISOString()
        });

        const userInfoStr = userInfo ? `, ${userInfo}` : '';
        logger.info(`${logPrefix} OAuth credentials file uploaded: ${targetFilePath} (provider: ${provider}${userInfoStr})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'File uploaded successfully',
            filePath: relativePath,
            originalName: req.file.originalname,
            provider: provider
        }));
        resolve(true);

    } catch (error) {
        logger.error(`${logPrefix} File upload processing error:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: 'File upload processing failed: ' + error.message
            }
        }));
        resolve(true);
    }
}

/**
 * 处理多文件上传（合并到同一目录，用于 Kiro IdC 凭证）
 */
async function handleMultipleFilesUpload(req, res, options, resolve) {
    const {
        providerMap = {},
        logPrefix = '[UI API]',
        userInfo = ''
    } = options;
    
    try {
        if (!req.files || req.files.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'No files were uploaded'
                }
            }));
            resolve(true);
            return;
        }

        const providerType = req.body.provider || 'common';
        const provider = providerMap[providerType] || providerType;
        
        // 创建目标目录（所有文件放在同一个目录下）
        let targetDir = path.join(process.cwd(), 'configs', provider);
        
        // 如果是kiro类型的凭证，创建一个共享的子文件夹
        if (provider === 'kiro') {
            const timestamp = Date.now();
            const subFolder = `${timestamp}_kiro-multi-creds`;
            targetDir = path.join(targetDir, subFolder);
        }
        
        await fs.mkdir(targetDir, { recursive: true });
        
        // 移动所有文件到目标目录
        const uploadedFiles = [];
        let primaryFilePath = null;
        
        for (const file of req.files) {
            const targetFilePath = path.join(targetDir, file.filename);
            await fs.rename(file.path, targetFilePath);
            
            const relativePath = path.relative(process.cwd(), targetFilePath);
            uploadedFiles.push({
                originalName: file.originalname,
                filePath: relativePath
            });
            
            // 第一个文件作为主文件路径返回
            if (!primaryFilePath) {
                primaryFilePath = relativePath;
            }
        }

        // 广播更新事件
        broadcastEvent('config_update', {
            action: 'add',
            filePath: primaryFilePath,
            files: uploadedFiles,
            provider: provider,
            timestamp: new Date().toISOString()
        });

        const userInfoStr = userInfo ? `, ${userInfo}` : '';
        logger.info(`${logPrefix} Multiple OAuth credentials files uploaded: ${uploadedFiles.length} files to ${targetDir} (provider: ${provider}${userInfoStr})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: `${uploadedFiles.length} files uploaded successfully`,
            filePath: primaryFilePath,
            files: uploadedFiles,
            provider: provider
        }));
        resolve(true);

    } catch (error) {
        logger.error(`${logPrefix} Multiple files upload processing error:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: 'Multiple files upload processing failed: ' + error.message
            }
        }));
        resolve(true);
    }
}