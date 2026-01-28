const axios = require('axios');
const EventEmitter = require('events');

class BurpService {
    constructor() {
        this.sessions = new Map(); // Map of baseUrl -> { sessionUrl, stream, requestMap }
        this.pendingHandshakes = new Map(); // Map of baseUrl -> Promise
    }

    /**
     * Internal method to perform a handshake and start listening for messages.
     */
    async _performHandshake(baseUrl, apiKey) {
        return new Promise((resolve, reject) => {
            const sseUrl = `${baseUrl.replace(/\/$/, '')}/sse`;
            const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

            console.log(`[BurpService] Starting new handshake at ${sseUrl}`);

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
                const requestMap = new Map(); // Map of jsonrpc id -> { resolve, reject, timeout }

                const sessionState = {
                    sessionUrl: null,
                    stream: response.data,
                    requestMap: requestMap
                };

                response.data.on('data', chunk => {
                    lineBuffer += chunk.toString();
                    const lines = lineBuffer.split(/\r?\n/);
                    lineBuffer = lines.pop();

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine === '') {
                            currentEvent = null;
                        } else if (trimmedLine.startsWith('event:')) {
                            currentEvent = trimmedLine.slice(6).trim();
                        } else if (trimmedLine.startsWith('data:')) {
                            const dataStr = trimmedLine.slice(5).trim();

                            if (currentEvent === 'endpoint') {
                                sessionState.sessionUrl = `${baseUrl.replace(/\/$/, '')}${dataStr}`;
                                console.log(`[BurpService] Handshake successful. Endpoint: ${sessionState.sessionUrl}`);
                                this.sessions.set(baseUrl, sessionState);
                                if (!resolved) {
                                    resolved = true;
                                    resolve(sessionState.sessionUrl);
                                }
                            } else if (currentEvent === 'message') {
                                try {
                                    const message = JSON.parse(dataStr);
                                    if (message.id && requestMap.has(message.id)) {
                                        const { resolve: res, timeout } = requestMap.get(message.id);
                                        clearTimeout(timeout);
                                        requestMap.delete(message.id);
                                        res(message);
                                    }
                                } catch (e) {
                                    console.error('[BurpService] Failed to parse message data:', e.message);
                                }
                            }
                        }
                    }
                });

                response.data.on('error', err => {
                    console.error('[BurpService] SSE Stream Error:', err);
                    if (!resolved) reject(err);
                    this.sessions.delete(baseUrl);
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

    /**
     * Sends a request and waits for the response on the SSE stream.
     */
    async _sendRequest(baseUrl, apiKey, method, params = {}) {
        const sessionUrl = await this.getSessionEndpoint(baseUrl, apiKey);
        const sessionState = this.sessions.get(baseUrl);

        if (!sessionState) throw new Error('Session state lost');

        const requestId = Date.now() + Math.floor(Math.random() * 1000);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                sessionState.requestMap.delete(requestId);
                reject(new Error(`Request ${method} (id: ${requestId}) timed out`));
            }, 30000);

            sessionState.requestMap.set(requestId, { resolve, reject, timeout });

            axios.post(sessionUrl, {
                jsonrpc: "2.0",
                id: requestId,
                method: method,
                params: params
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            }).then(response => {
                if (response.data !== 'Accepted' && response.data.result) {
                    // If the server actually returned the result in the POST response
                    clearTimeout(timeout);
                    sessionState.requestMap.delete(requestId);
                    resolve(response.data);
                }
                // Otherwise wait for the SSE message
            }).catch(err => {
                clearTimeout(timeout);
                sessionState.requestMap.delete(requestId);
                reject(err);
            });
        });
    }

    async callTool(baseUrl, apiKey, toolName, args = {}) {
        try {
            const response = await this._sendRequest(baseUrl, apiKey, "tools/call", {
                name: toolName,
                arguments: args
            });
            return response;
        } catch (error) {
            if (error.response?.status === 404 || error.message.includes('timed out')) {
                console.log(`[BurpService] Retry callTool due to: ${error.message}`);
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
                if (Array.isArray(response.result.tools)) {
                    tools = response.result.tools;
                } else if (Array.isArray(response.result)) {
                    tools = response.result;
                }
            }
            console.log(`[BurpService] Found ${tools.length} tools`);
            return tools;
        } catch (error) {
            if (error.response?.status === 404 || error.message.includes('timed out')) {
                console.log(`[BurpService] Retry listTools due to: ${error.message}`);
                await this.getSessionEndpoint(baseUrl, apiKey, true);
                const response = await this._sendRequest(baseUrl, apiKey, "tools/list");
                return response.result?.tools || response.result || [];
            }
            throw error;
        }
    }
}

module.exports = new BurpService();
