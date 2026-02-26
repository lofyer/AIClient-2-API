import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkerPool {
    constructor(workerPath, numThreads) {
        this.workerPath = workerPath;
        this.numThreads = numThreads;
        this.workers = [];
        this.idleWorkers = [];
        this.activeCallbacks = new Map();
        this.messageIdCounter = 0;
        this.queue = [];

        // 初始化 workers
        for (let i = 0; i < numThreads; i++) {
            this._addWorker();
        }
    }

    _addWorker() {
        const worker = new Worker(this.workerPath);

        worker.on('message', (message) => {
            const { bufferId, events, remainingArrayBuffer, error } = message;

            if (this.activeCallbacks.has(bufferId)) {
                const callbacks = this.activeCallbacks.get(bufferId);
                this.activeCallbacks.delete(bufferId);

                if (error) {
                    callbacks.reject(new Error(error));
                } else {
                    // Convert back ArrayBuffer to Buffer for the main thread
                    const remainingBuffer = Buffer.from(remainingArrayBuffer);
                    callbacks.resolve({ events, remaining: remainingBuffer });
                }
            }

            // 回收 worker
            this.idleWorkers.push(worker);
            this._processQueue();
        });

        worker.on('error', (err) => {
            console.error(`[WorkerPool] Worker error: ${err.message}`);
            this._replaceWorker(worker);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`[WorkerPool] Worker stopped with exit code ${code}`);
                this._replaceWorker(worker);
            }
        });

        this.workers.push(worker);
        this.idleWorkers.push(worker);
    }

    _replaceWorker(worker) {
        // Remove bad worker
        this.workers = this.workers.filter(w => w !== worker);
        this.idleWorkers = this.idleWorkers.filter(w => w !== worker);
        this._addWorker();
    }

    _processQueue() {
        if (this.idleWorkers.length > 0 && this.queue.length > 0) {
            const worker = this.idleWorkers.pop();
            const task = this.queue.shift();

            this.activeCallbacks.set(task.bufferId, {
                resolve: task.resolve,
                reject: task.reject
            });

            // Zero-copy transfer ArrayBuffer to the worker
            worker.postMessage({
                type: 'parse',
                bufferId: task.bufferId,
                bufferData: task.arrayBuffer
            }, [task.arrayBuffer]);
        }
    }

    /**
     * Dispatch an AWS Stream buffer chunk to the worker pool for parsing.
     * @param {Buffer} buffer The binary buffer from the API
     * @returns {Promise<{events: Array, remaining: Buffer}>}
     */
    parseAwsEventStreamBufferAsync(buffer) {
        return new Promise((resolve, reject) => {
            const bufferId = this.messageIdCounter++;

            // Extract the underlying ArrayBuffer for zero-copy transfer
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

            this.queue.push({
                bufferId,
                arrayBuffer,
                resolve,
                reject
            });

            this._processQueue();
        });
    }

    terminate() {
        for (const worker of this.workers) {
            worker.terminate();
        }
    }
}

// 单例模式，根据 CPU 核心数实例化 2-4 个 worker (不需要太多，Kiro 回调属于轻微密集型)
const numCPUs = os.cpus().length;
const poolSize = Math.max(2, Math.min(numCPUs, 4));
const workerPath = path.join(__dirname, 'kiro-parser.worker.js');

const kiroParserPool = new WorkerPool(workerPath, poolSize);

export default kiroParserPool;
