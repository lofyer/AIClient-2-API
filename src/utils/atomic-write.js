import * as fs from 'fs';
import { promises as pfs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import logger from './logger.js';

const fileLocks = new Map();

/**
 * 获取文件锁（简单的异步互斥锁）
 * @param {string} filePath - 文件路径
 * @returns {Promise<Function>} 释放锁的函数
 */
async function acquireLock(filePath) {
    const key = path.resolve(filePath);
    while (fileLocks.has(key)) {
        await fileLocks.get(key);
    }
    let releaseLock;
    const lockPromise = new Promise(resolve => { releaseLock = resolve; });
    fileLocks.set(key, lockPromise);
    return () => {
        fileLocks.delete(key);
        releaseLock();
    };
}

/**
 * 原子写入 JSON 文件（写临时文件再 rename，带互斥锁）
 * @param {string} filePath - 目标文件路径
 * @param {Object} data - 要写入的 JSON 数据
 */
export async function atomicWriteJson(filePath, data) {
    const release = await acquireLock(filePath);
    try {
        const content = JSON.stringify(data, null, 2);
        const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
        await pfs.writeFile(tmpPath, content, 'utf8');
        await pfs.rename(tmpPath, filePath);
    } catch (error) {
        logger.error(`[Atomic Write] Failed to write ${filePath}: ${error.message}`);
        throw error;
    } finally {
        release();
    }
}

/**
 * 原子读取-修改-写入 JSON 文件（带互斥锁，防止并发读写竞争）
 * @param {string} filePath - 目标文件路径
 * @param {Function} modifier - 修改函数，接收当前数据，返回修改后的数据
 * @returns {Promise<Object>} 修改后的数据
 */
export async function atomicModifyJson(filePath, modifier) {
    const release = await acquireLock(filePath);
    try {
        let currentData = {};
        try {
            const content = await pfs.readFile(filePath, 'utf8');
            currentData = JSON.parse(content);
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                currentData = {};
            } else {
                throw readError;
            }
        }

        const newData = await modifier(currentData);
        const content = JSON.stringify(newData, null, 2);
        const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
        await pfs.writeFile(tmpPath, content, 'utf8');
        await pfs.rename(tmpPath, filePath);
        return newData;
    } catch (error) {
        logger.error(`[Atomic Write] Failed to modify ${filePath}: ${error.message}`);
        throw error;
    } finally {
        release();
    }
}

/**
 * 同步风格的原子写入（供 writeFileSync 替换使用，实际仍是同步操作）
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 文件内容
 */
export function atomicWriteFileSync(filePath, content) {
    const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
}
