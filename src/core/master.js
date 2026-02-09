/**
 * 主进程 (Master Process) - Cluster 多核模式
 * 
 * 使用 Node.js cluster 模块启动多个 worker 进程共享同一端口，
 * 充分利用多核 CPU，避免单核 100% 瓶颈。
 * 
 * 使用方式：
 * node src/core/master.js [原有的命令行参数]
 */

import cluster from 'cluster';
import { availableParallelism } from 'os';
import logger from '../utils/logger.js';
import * as http from 'http';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const numCPUs = availableParallelism();

// worker 状态跟踪
const workerStatuses = new Map();

// 配置
const config = {
    workerScript: path.join(__dirname, '../services/api-server.js'),
    maxRestartAttempts: 10,
    restartDelay: 1000,
    masterPort: parseInt(process.env.MASTER_PORT) || 3100,
    numWorkers: parseInt(process.env.CLUSTER_WORKERS) || numCPUs,
    args: process.argv.slice(2)
};

// 全局重启锁
let isRestartingAll = false;

/**
 * 启动单个 worker
 */
function forkWorker() {
    const workerCount = Object.keys(cluster.workers || {}).length + 1;
    const worker = cluster.fork({
        ...process.env,
        IS_WORKER_PROCESS: 'true',
        CLUSTER_MODE: 'true',
        CLUSTER_WORKER_ID: String(workerCount)
    });

    workerStatuses.set(worker.id, {
        pid: worker.process.pid,
        startTime: new Date().toISOString(),
        restartCount: 0,
        isRunning: true
    });

    logger.info(`[Master] Worker #${worker.id} started, PID: ${worker.process.pid}`);

    worker.on('message', (message) => {
        handleWorkerMessage(worker, message);
    });

    return worker;
}

/**
 * 启动所有 worker
 */
function startAllWorkers() {
    const count = config.numWorkers;
    logger.info(`[Master] Starting ${count} worker(s) for ${numCPUs} CPU core(s)...`);

    for (let i = 0; i < count; i++) {
        forkWorker();
    }
}

/**
 * 停止所有 worker
 * @param {boolean} graceful
 * @returns {Promise<void>}
 */
function stopAllWorkers(graceful = true) {
    return new Promise((resolve) => {
        const workers = Object.values(cluster.workers || {});
        if (workers.length === 0) {
            resolve();
            return;
        }

        let remaining = workers.length;
        const onDone = () => {
            remaining--;
            if (remaining <= 0) resolve();
        };

        const timeout = setTimeout(() => {
            for (const w of Object.values(cluster.workers || {})) {
                try { w.process.kill('SIGKILL'); } catch (_) {}
            }
            resolve();
        }, 5000);

        for (const w of workers) {
            w.once('exit', () => {
                onDone();
                if (remaining <= 0) clearTimeout(timeout);
            });
            if (graceful) {
                try { w.send({ type: 'shutdown' }); } catch (_) {}
                w.kill('SIGTERM');
            } else {
                w.process.kill('SIGKILL');
            }
        }
    });
}

/**
 * 重启所有 worker（滚动重启）
 * @returns {Promise<Object>}
 */
async function restartAllWorkers() {
    if (isRestartingAll) {
        return { success: false, message: 'Restart already in progress' };
    }

    isRestartingAll = true;
    logger.info('[Master] Restarting all workers...');

    try {
        await stopAllWorkers(true);
        await new Promise(resolve => setTimeout(resolve, config.restartDelay));
        workerStatuses.clear();
        startAllWorkers();
        isRestartingAll = false;
        return {
            success: true,
            message: `All ${config.numWorkers} workers restarted`,
            workers: getWorkersInfo()
        };
    } catch (error) {
        isRestartingAll = false;
        logger.error('[Master] Failed to restart workers:', error.message);
        return { success: false, message: 'Failed to restart: ' + error.message };
    }
}

/**
 * 处理来自 worker 的消息
 */
function handleWorkerMessage(worker, message) {
    if (!message || !message.type) return;

    switch (message.type) {
        case 'ready':
            logger.info(`[Master] Worker #${worker.id} (PID: ${worker.process.pid}) is ready`);
            break;
        case 'restart_request':
            logger.info(`[Master] Worker #${worker.id} requested restart`);
            restartAllWorkers();
            break;
        case 'status':
            logger.info(`[Master] Worker #${worker.id} status:`, message.data);
            break;
        default:
            break;
    }
}

/**
 * 获取所有 worker 信息
 */
function getWorkersInfo() {
    const workers = [];
    for (const id in cluster.workers) {
        const w = cluster.workers[id];
        const status = workerStatuses.get(parseInt(id)) || {};
        workers.push({
            id: parseInt(id),
            pid: w.process.pid,
            startTime: status.startTime,
            restartCount: status.restartCount || 0,
            isRunning: !w.isDead()
        });
    }
    return workers;
}

/**
 * 获取状态信息
 */
function getStatus() {
    return {
        master: {
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            numCPUs: numCPUs,
            configuredWorkers: config.numWorkers
        },
        workers: getWorkersInfo()
    };
}

/**
 * 创建主进程管理 HTTP 服务器
 */
function createMasterServer() {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const urlPath = url.pathname;
        const method = req.method;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (method === 'GET' && urlPath === '/master/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(getStatus()));
            return;
        }

        if (method === 'POST' && urlPath === '/master/restart') {
            logger.info('[Master] Restart requested via API');
            const result = await restartAllWorkers();
            res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        if (method === 'POST' && urlPath === '/master/stop') {
            logger.info('[Master] Stop requested via API');
            await stopAllWorkers(true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'All workers stopped' }));
            return;
        }

        if (method === 'POST' && urlPath === '/master/start') {
            logger.info('[Master] Start requested via API');
            const currentWorkers = Object.keys(cluster.workers || {}).length;
            if (currentWorkers >= config.numWorkers) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'All workers already running' }));
                return;
            }
            startAllWorkers();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Workers started', workers: getWorkersInfo() }));
            return;
        }

        if (method === 'GET' && urlPath === '/master/health') {
            const aliveCount = Object.values(cluster.workers || {}).filter(w => !w.isDead()).length;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                workersRunning: aliveCount,
                totalWorkers: config.numWorkers,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(config.masterPort, () => {
        logger.info(`[Master] Management server listening on port ${config.masterPort}`);
        logger.info(`[Master] Available endpoints:`);
        logger.info(`  GET  /master/status  - Get master and workers status`);
        logger.info(`  GET  /master/health  - Health check`);
        logger.info(`  POST /master/restart - Restart all workers`);
        logger.info(`  POST /master/stop    - Stop all workers`);
        logger.info(`  POST /master/start   - Start workers`);
    });

    return server;
}

/**
 * 处理进程信号
 */
function setupSignalHandlers() {
    process.on('SIGTERM', async () => {
        logger.info('[Master] Received SIGTERM, shutting down...');
        await stopAllWorkers(true);
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('[Master] Received SIGINT, shutting down...');
        await stopAllWorkers(true);
        process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        logger.error('[Master] Uncaught exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('[Master] Unhandled rejection at:', promise, 'reason:', reason);
    });
}

/**
 * 设置 cluster 事件监听
 */
function setupClusterEvents() {
    cluster.on('exit', (worker, code, signal) => {
        logger.info(`[Master] Worker #${worker.id} (PID: ${worker.process.pid}) exited, code: ${code}, signal: ${signal}`);
        workerStatuses.delete(worker.id);

        if (!isRestartingAll && code !== 0) {
            const totalRestarts = Array.from(workerStatuses.values()).reduce((sum, s) => sum + (s.restartCount || 0), 0);
            if (totalRestarts < config.maxRestartAttempts) {
                logger.info(`[Master] Restarting crashed worker...`);
                setTimeout(() => {
                    const newWorker = forkWorker();
                    const status = workerStatuses.get(newWorker.id);
                    if (status) status.restartCount = (status.restartCount || 0) + 1;
                }, config.restartDelay);
            } else {
                logger.error('[Master] Max restart attempts reached, not restarting worker');
            }
        }
    });
}

/**
 * 主函数
 */
async function main() {
    if (cluster.isPrimary) {
        logger.info('='.repeat(50));
        logger.info('[Master] AIClient2API Master Process (Cluster Mode)');
        logger.info('[Master] PID:', process.pid);
        logger.info('[Master] Node version:', process.version);
        logger.info('[Master] CPU cores:', numCPUs);
        logger.info('[Master] Workers to start:', config.numWorkers);
        logger.info('[Master] Working directory:', process.cwd());
        logger.info('='.repeat(50));

        // cluster 模式下，设置 worker 执行的脚本
        cluster.setupPrimary({
            exec: config.workerScript,
            args: config.args,
            silent: false
        });

        setupSignalHandlers();
        setupClusterEvents();
        createMasterServer();
        startAllWorkers();
    }
    // worker 进程由 cluster.fork() 自动执行 workerScript (api-server.js)
}

main().catch(error => {
    logger.error('[Master] Failed to start:', error);
    process.exit(1);
});
