const axios = require('axios');
const EventEmitter = require('events');

class BurpService {
    /**
     * Performs a handshake with the Burp MCP server via SSE.
     * Starts an SSE connection, waits for the 'endpoint' event to get the session URL,
     * and then returns that URL for further POST requests.
     */
    async getSessionEndpoint(baseUrl, apiKey) {
        return new Promise((resolve, reject) => {
            const sseUrl = `${baseUrl.replace(/\/$/, '')}/sse`;
            const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

            console.log(`[BurpService] Starting handshake at ${sseUrl}`);

            axios({
                method: 'get',
                url: sseUrl,
                headers: {
                    ...headers,
                    'Accept': 'text/event-stream'
                },
                responseType: 'stream',
                timeout: 20000
            }).then(response => {
                let sessionUrl = null;

                let lineBuffer = '';
                let currentEvent = null;
                let currentData = null;

                response.data.on('data', chunk => {
                    lineBuffer += chunk.toString();
                    const lines = lineBuffer.split(/\r?\n/);
                    lineBuffer = lines.pop(); // Keep partial line in buffer

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine === '') {
                            // Message boundary - reset for next message if not resolved
                            currentEvent = null;
                            currentData = null;
                        } else if (trimmedLine.startsWith('event:')) {
                            currentEvent = trimmedLine.slice(6).trim();
                        } else if (trimmedLine.startsWith('data:')) {
                            currentData = trimmedLine.slice(5).trim();
                        }

                        // Check if we have both event and data for the handshake
                        if (currentEvent === 'endpoint' && currentData) {
                            sessionUrl = `${baseUrl.replace(/\/$/, '')}${currentData}`;
                            console.log(`[BurpService] Handshake successful. Endpoint: ${sessionUrl}`);

                            response.data.destroy();
                            resolve(sessionUrl);
                            return;
                        }
                    }
                });

                response.data.on('error', err => {
                    console.error('[BurpService] SSE Stream Error:', err);
                    reject(err);
                });

                // Set a safety timeout for the event
                setTimeout(() => {
                    if (!sessionUrl) {
                        response.data.destroy();
                        reject(new Error('Handshake timed out waiting for endpoint event'));
                    }
                }, 15000);

            }).catch(err => {
                console.error('[BurpService] SSE Connection Failed:', err.message);
                reject(err);
            });
        });
    }

    /**
     * Calls a specific tool using the MCP JSON-RPC 2.0 protocol.
     */
    async callTool(endpointUrl, toolName, args = {}) {
        try {
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
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error(`[BurpService] Tool Call Error (${toolName}):`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Lists available tools on the MCP server.
     */
    async listTools(endpointUrl) {
        try {
            const response = await axios.post(endpointUrl, {
                jsonrpc: "2.0",
                id: Date.now(),
                method: "tools/list",
                params: {}
            });
            return response.data.result?.tools || [];
        } catch (error) {
            console.error('[BurpService] List Tools Error:', error.message);
            throw error;
        }
    }
}

module.exports = new BurpService();
