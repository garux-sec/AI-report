const axios = require('axios');
const EventEmitter = require('events');

class BurpService {
    constructor() {
        this.sessions = new Map(); // Map of baseUrl -> sessionUrl
        this.pendingHandshakes = new Map(); // Map of baseUrl -> Promise
    }

    /**
     * Internal method to perform a handshake.
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
                let currentData = null;

                response.data.on('data', chunk => {
                    if (resolved) return;

                    lineBuffer += chunk.toString();
                    const lines = lineBuffer.split(/\r?\n/);
                    lineBuffer = lines.pop();

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine === '') {
                            currentEvent = null;
                            currentData = null;
                        } else if (trimmedLine.startsWith('event:')) {
                            currentEvent = trimmedLine.slice(6).trim();
                        } else if (trimmedLine.startsWith('data:')) {
                            currentData = trimmedLine.slice(5).trim();
                        }

                        if (currentEvent === 'endpoint' && currentData) {
                            const sessionUrl = `${baseUrl.replace(/\/$/, '')}${currentData}`;
                            console.log(`[BurpService] Handshake successful. Endpoint: ${sessionUrl}`);

                            resolved = true;
                            this.sessions.set(baseUrl, sessionUrl);

                            // Keep the stream alive as long as possible or let axios manage it?
                            // For MCP-SSE, the stream MUST stay alive to keep the session active.
                            // If we destroy it, the session might be closed by the server.
                            // However, we need a way to track if the stream dies.
                            response.data.on('close', () => {
                                console.log(`[BurpService] SSE Stream closed for ${baseUrl}`);
                                if (this.sessions.get(baseUrl) === sessionUrl) {
                                    this.sessions.delete(baseUrl);
                                }
                            });

                            resolve(sessionUrl);
                            return;
                        }
                    }
                });

                response.data.on('error', err => {
                    console.error('[BurpService] SSE Stream Error:', err);
                    if (!resolved) reject(err);
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

    /**
     * Gets or creates a session endpoint for a baseUrl.
     */
    async getSessionEndpoint(baseUrl, apiKey, forceRefresh = false) {
        if (!forceRefresh && this.sessions.has(baseUrl)) {
            return this.sessions.get(baseUrl);
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
     * Calls a specific tool, retrying once if the session is stale.
     */
    async callTool(baseUrl, apiKey, toolName, args = {}) {
        let endpointUrl = await this.getSessionEndpoint(baseUrl, apiKey);

        try {
            return await this._executeCall(endpointUrl, toolName, args);
        } catch (error) {
            // If the error looks like a session issue (e.g., 404 on the message endpoint)
            // or connection refused, try one refresh.
            if (error.response?.status === 404 || !error.response) {
                console.log(`[BurpService] Potential stale session, retrying once with new handshake...`);
                endpointUrl = await this.getSessionEndpoint(baseUrl, apiKey, true);
                return await this._executeCall(endpointUrl, toolName, args);
            }
            throw error;
        }
    }

    async _executeCall(endpointUrl, toolName, args) {
        console.log(`[BurpService] Calling tool '${toolName}' at ${endpointUrl}`);
        const response = await axios.post(endpointUrl, {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        return response.data;
    }

    /**
     * Lists available tools on the MCP server.
     */
    async listTools(baseUrl, apiKey) {
        let endpointUrl = await this.getSessionEndpoint(baseUrl, apiKey);

        try {
            return await this._executeList(endpointUrl);
        } catch (error) {
            if (error.response?.status === 404 || !error.response) {
                endpointUrl = await this.getSessionEndpoint(baseUrl, apiKey, true);
                return await this._executeList(endpointUrl);
            }
            throw error;
        }
    }

    async _executeList(endpointUrl) {
        console.log(`[BurpService] Listing tools at ${endpointUrl}`);
        const response = await axios.post(endpointUrl, {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/list",
            params: {}
        }, { timeout: 10000 });

        let tools = [];
        if (response.data.result) {
            if (Array.isArray(response.data.result.tools)) {
                tools = response.data.result.tools;
            } else if (Array.isArray(response.data.result)) {
                tools = response.data.result;
            }
        }
        console.log(`[BurpService] Found ${tools.length} tools`);
        return tools;
    }
}

module.exports = new BurpService();
