import { workerData, parentPort } from 'worker_threads';
import { EventStreamCodec } from '@aws-sdk/eventstream-codec';
import { toUtf8, fromUtf8 } from '@aws-sdk/util-utf8-node';

// 每个 worker 独立初始化一个编解码器
const codec = new EventStreamCodec(toUtf8, fromUtf8);

parentPort.on('message', (message) => {
    if (message.type === 'parse') {
        const { bufferStart, bufferLen, bufferId } = message;
        // const uint8Buffer = Buffer.from(bufferStart, 0, bufferLen);
        const uint8Buffer = Buffer.from(message.bufferData);

        try {
            const events = [];
            let offset = 0;

            while (offset < uint8Buffer.length) {
                // AWS Event Stream 消息格式：前4字节是消息总长度（大端序）
                if (offset + 4 > uint8Buffer.length) break;

                const totalLength = uint8Buffer.readUInt32BE(offset);

                // 检查是否有完整的消息
                if (totalLength < 16 || offset + totalLength > uint8Buffer.length) break;

                try {
                    // 提取单个消息的字节
                    const messageBytes = uint8Buffer.slice(offset, offset + totalLength);
                    const decoded = codec.decode(messageBytes);

                    // 从 headers 获取事件类型 (这里可以优化, 但保持原逻辑)
                    // const eventType = decoded.headers[':event-type']?.value;

                    // 解析 body
                    const bodyStr = new TextDecoder().decode(decoded.body);
                    if (bodyStr) {
                        const parsed = JSON.parse(bodyStr);

                        // 处理 content 事件
                        if (parsed.content !== undefined && !parsed.followupPrompt) {
                            events.push({ type: 'content', data: parsed.content });
                        }
                        // 处理结构化工具调用事件 - 开始事件（包含 name 和 toolUseId）
                        else if (parsed.name && parsed.toolUseId) {
                            events.push({
                                type: 'toolUse',
                                data: {
                                    name: parsed.name,
                                    toolUseId: parsed.toolUseId,
                                    input: parsed.input || '',
                                    stop: parsed.stop || false
                                }
                            });
                        }
                        // 处理工具调用的 input 续传事件（只有 input 字段）
                        else if (parsed.input !== undefined && !parsed.name) {
                            events.push({
                                type: 'toolUseInput',
                                data: {
                                    input: parsed.input
                                }
                            });
                        }
                        // 处理工具调用的结束事件（只有 stop 字段，且不包含 contextUsagePercentage）
                        else if (parsed.stop !== undefined && parsed.contextUsagePercentage === undefined) {
                            events.push({
                                type: 'toolUseStop',
                                data: {
                                    stop: parsed.stop
                                }
                            });
                        }
                        // 处理上下文使用百分比事件（最后一条消息）
                        else if (parsed.contextUsagePercentage !== undefined) {
                            events.push({
                                type: 'contextUsage',
                                data: {
                                    contextUsagePercentage: parsed.contextUsagePercentage
                                }
                            });
                        }
                    }

                    offset += totalLength;
                } catch (e) {
                    // 解码失败，可能是不完整的消息，保留剩余数据
                    break;
                }
            }

            // 返回未处理的剩余数据和解析出的事件
            const remainingArrayBuffer = uint8Buffer.buffer.slice(uint8Buffer.byteOffset + offset, uint8Buffer.byteOffset + uint8Buffer.byteLength);

            parentPort.postMessage({
                bufferId,
                events,
                remainingArrayBuffer,
            }, [remainingArrayBuffer]); // Zero-copy transfer

        } catch (error) {
            parentPort.postMessage({
                bufferId,
                error: error.message
            });
        }
    }
});
