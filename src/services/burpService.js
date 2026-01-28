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
                timeout: 10000
            }).then(response => {
                let sessionUrl = null;

                response.data.on('data', chunk => {
                    const lines = chunk.toString().split('\n');
                    let currentEvent = null;

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            currentEvent = line.replace('event:', '').trim();
                        } else if (line.startsWith('data:') && currentEvent === 'endpoint') {
                            const data = line.replace('data:', '').trim();
                            // The data usually contains the path like /message?sessionId=...
                            // We combine it with the baseUrl
                            sessionUrl = `${baseUrl.replace(/\/$/, '')}${data}`;
                            console.log(`[BurpService] Handshake successful. Endpoint: ${sessionUrl}`);

                            // Once we have the endpoint, we can stop the SSE stream
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
                }, 8000);

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
