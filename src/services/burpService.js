const axios = require('axios');
const EventEmitter = require('events');

class BurpService {
    constructor() {
        this.sessions = new Map(); // Map of baseUrl -> { sessionUrl, stream, requestMap }
        this.pendingHandshakes = new Map(); // Map of baseUrl -> Promise
    }

    /**
     * Handshake and start persistent SSE stream.
     */
    async _performHandshake(baseUrl, apiKey) {
        return new Promise((resolve, reject) => {
            const sseUrl = `${baseUrl.replace(/\/$/, '')}/sse`;
            const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

            console.log(`[BurpService] Starting persistent handshake at ${sseUrl}`);

            axios({
                method: 'get',
                url: sseUrl,
                headers: {
                    ...headers,
                    'Accept': 'text/event-stream'
                },
                responseType: 'stream',
                timeout: 30000
            }).then(response => {
                let resolved = false;
                let lineBuffer = '';
                let currentEvent = null;
                let currentData = null;
                const requestMap = new Map();

                const sessionState = {
                    sessionUrl: null,
                    stream: response.data,
                    requestMap: requestMap
                };

                const processBlock = (event, data) => {
                    if (!event && !data) return;

                    if (event === 'endpoint' && data) {
                        sessionState.sessionUrl = `${baseUrl.replace(/\/$/, '')}${data}`;
                        console.log(`[BurpService] Handshake successful. Endpoint: ${sessionState.sessionUrl}`);
                        this.sessions.set(baseUrl, sessionState);
                        if (!resolved) {
                            resolved = true;
                            resolve(sessionState.sessionUrl);
                        }
                    } else if (event === 'message' && data) {
                        try {
                            const message = JSON.parse(data);
                            console.log(`[BurpService] Received RPC message:`, message.id);
                            if (message.id && requestMap.has(message.id)) {
                                const { resolve: res, timeout } = requestMap.get(message.id);
                                clearTimeout(timeout);
                                requestMap.delete(message.id);
                                res(message);
                            }
                        } catch (e) {
                            console.warn('[BurpService] Failed to parse message JSON:', data);
                        }
                    }
                };

                response.data.on('data', chunk => {
                    lineBuffer += chunk.toString();
                    const lines = lineBuffer.split(/\r?\n/);
                    lineBuffer = lines.pop();

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine === '') {
                            processBlock(currentEvent, currentData);
                            currentEvent = null;
                            currentData = null;
                        } else if (trimmedLine.startsWith('event:')) {
                            currentEvent = trimmedLine.slice(6).trim();
                        } else if (trimmedLine.startsWith('data:')) {
                            const value = trimmedLine.slice(5).trim();
                            currentData = currentData ? currentData + '\n' + value : value;
                        }
                    }
                });

                response.data.on('error', err => {
                    console.error('[BurpService] SSE Stream Error:', err);
                    this.sessions.delete(baseUrl);
                    if (!resolved) reject(err);
                });

                response.data.on('close', () => {
                    console.log(`[BurpService] SSE Stream closed for ${baseUrl}`);
                    this.sessions.delete(baseUrl);
                });

                setTimeout(() => {
                    if (!resolved) {
                        response.data.destroy();
                        reject(new Error('Handshake timed out waiting for endpoint event'));
                    }
                }, 20000);

            }).catch(err => {
                console.error('[BurpService] SSE Connection Failed:', err.message);
                reject(err);
            });
        });
    }

    async getSessionEndpoint(baseUrl, apiKey, forceRefresh = false) {
        if (!forceRefresh && this.sessions.has(baseUrl)) {
            return this.sessions.get(baseUrl).sessionUrl;
        }

        if (this.pendingHandshakes.has(baseUrl)) {
            return this.pendingHandshakes.get(baseUrl);
        }

        const handshakePromise = this._performHandshake(baseUrl, apiKey).finally(() => {
            this.pendingHandshakes.delete(baseUrl);
        });

        this.pendingHandshakes.set(baseUrl, handshakePromise);
        return handshakePromise;
    }

    async _sendRequest(baseUrl, apiKey, method, params = {}) {
        const sessionUrl = await this.getSessionEndpoint(baseUrl, apiKey);
        const sessionState = this.sessions.get(baseUrl);
        if (!sessionState) throw new Error('Session lost');

        const requestId = Date.now() + Math.floor(Math.random() * 1000);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                sessionState.requestMap.delete(requestId);
                reject(new Error(`MCP Request ${method} (id: ${requestId}) timed out after 30s`));
            }, 30000);

            sessionState.requestMap.set(requestId, { resolve, reject, timeout });

            console.log(`[BurpService] Sending ${method} (id: ${requestId}) to ${sessionUrl}`);

            axios.post(sessionUrl, {
                jsonrpc: "2.0",
                id: requestId,
                method: method,
                params: params
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            }).then(response => {
                // If Burp returns the result directly (rare for this setup)
                if (response.data && response.data.jsonrpc && response.data.result) {
                    console.log(`[BurpService] Received immediate result for ${requestId}`);
                    clearTimeout(timeout);
                    sessionState.requestMap.delete(requestId);
                    resolve(response.data);
                }
                // Else wait for the SSE 'message' event which we handle in the stream listener
            }).catch(err => {
                clearTimeout(timeout);
                sessionState.requestMap.delete(requestId);
                reject(err);
            });
        });
    }

    async callTool(baseUrl, apiKey, toolName, args = {}) {
        try {
            return await this._sendRequest(baseUrl, apiKey, "tools/call", {
                name: toolName,
                arguments: args
            });
        } catch (error) {
            if (error.message.includes('timed out') || error.response?.status === 404) {
                console.log(`[BurpService] Retrying callTool...`);
                await this.getSessionEndpoint(baseUrl, apiKey, true);
                return await this._sendRequest(baseUrl, apiKey, "tools/call", {
                    name: toolName,
                    arguments: args
                });
            }
            throw error;
        }
    }

    async listTools(baseUrl, apiKey) {
        try {
            const response = await this._sendRequest(baseUrl, apiKey, "tools/list");
            let tools = [];
            if (response.result) {
                tools = Array.isArray(response.result.tools) ? response.result.tools : (Array.isArray(response.result) ? response.result : []);
            }
            console.log(`[BurpService] Found ${tools.length} tools`);
            return tools;
        } catch (error) {
            if (error.message.includes('timed out') || error.response?.status === 404) {
                console.log(`[BurpService] Retrying listTools...`);
                await this.getSessionEndpoint(baseUrl, apiKey, true);
                const response = await this._sendRequest(baseUrl, apiKey, "tools/list");
                return response.result?.tools || response.result || [];
            }
            throw error;
        }
    }
}

module.exports = new BurpService();
