import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * 根据全局代理配置和提供商的 useProxy 设置创建代理 agent
 * @param {Object} globalConfig - 全局配置对象
 * @param {boolean} useProxy - 提供商是否启用代理
 * @returns {Object|null} 代理 agent 或 null
 */
export function createProxyAgent(globalConfig, useProxy = false) {
    if (!useProxy) {
        return null;
    }

    const proxyConfig = globalConfig?.GLOBAL_PROXY;
    if (!proxyConfig || !proxyConfig.enabled) {
        return null;
    }

    const { type, host, port } = proxyConfig;
    if (!host || !port) {
        console.warn('[Proxy] Proxy enabled but host or port is missing');
        return null;
    }

    const proxyUrl = `${type}://${host}:${port}`;
    console.log(`[Proxy] Creating proxy agent: ${proxyUrl}`);

    try {
        if (type === 'socks5' || type === 'socks4') {
            return new SocksProxyAgent(proxyUrl);
        } else {
            // http 或 https
            return new HttpsProxyAgent(proxyUrl);
        }
    } catch (error) {
        console.error('[Proxy] Failed to create proxy agent:', error.message);
        return null;
    }
}
