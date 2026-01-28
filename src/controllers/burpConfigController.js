const BurpConfig = require('../models/BurpConfig');
const burpService = require('../services/burpService');
const AIService = require('../services/AIService');

exports.getConfigs = async (req, res) => {
    // ... existing getConfigs ...
    try {
        const configs = await BurpConfig.find();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching Burp configs' });
    }
};

exports.createConfig = async (req, res) => {
    try {
        const { name, url, apiKey } = req.body;

        // If this is the first config, make it default
        const count = await BurpConfig.countDocuments();
        const isDefault = count === 0;

        const config = new BurpConfig({
            name,
            url,
            apiKey,
            isEnabled: true,
            isDefault
        });

        await config.save();
        res.status(201).json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error creating Burp config', error: error.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const { name, url, apiKey, isEnabled } = req.body;
        const config = await BurpConfig.findByIdAndUpdate(
            req.params.id,
            { name, url, apiKey, isEnabled },
            { new: true }
        );
        if (!config) return res.status(404).json({ message: 'Config not found' });
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error updating Burp config' });
    }
};

exports.deleteConfig = async (req, res) => {
    try {
        const config = await BurpConfig.findByIdAndDelete(req.params.id);
        if (!config) return res.status(404).json({ message: 'Config not found' });
        res.json({ message: 'Config deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting Burp config' });
    }
};

exports.setDefault = async (req, res) => {
    try {
        // Unset previous default
        await BurpConfig.updateMany({}, { isDefault: false });
        // Set new default
        const config = await BurpConfig.findByIdAndUpdate(req.params.id, { isDefault: true }, { new: true });
        if (!config) return res.status(404).json({ message: 'Config not found' });
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error setting default config' });
    }
};

exports.testConnection = async (req, res) => {
    try {
        const { url, apiKey } = req.body;

        // Verify full protocol functionality by listing tools
        // listTools will handle getSessionEndpoint internally
        const tools = await burpService.listTools(url, apiKey);
        const endpoint = await burpService.getSessionEndpoint(url, apiKey);

        res.json({ online: true, toolsCount: tools.length, sessionUrl: endpoint });
    } catch (error) {
        console.error('[BurpConfigController] Test Connection Failed:', error);
        res.json({ online: false, message: error.message });
    }
};

exports.listTools = async (req, res) => {
    try {
        const config = await BurpConfig.findById(req.params.id);
        if (!config) return res.status(404).json({ message: 'Config not found' });

        const tools = await burpService.listTools(config.url, config.apiKey);

        res.json(tools);
    } catch (error) {
        res.status(500).json({ message: 'Error listing tools', error: error.message });
    }
};

exports.analyzeHistory = async (req, res) => {
    try {
        const { configId, provider, model } = req.body;

        const config = await BurpConfig.findById(configId);
        if (!config) return res.status(404).json({ message: 'Burp config not found' });

        // 1. Fetch History from Burp
        console.log(`[BurpAnalysis] Fetching history from ${config.url}...`);

        // Ensure session is active
        await burpService.getSessionEndpoint(config.url, config.apiKey);

        // Call MCP tool: get_proxy_http_history
        // We accept that typical servers might return all or a significant chunk
        const historyResponse = await burpService.callTool(config.url, config.apiKey, "get_proxy_http_history", {});

        let historyItems = [];
        if (historyResponse.result) {
            const raw = historyResponse.result.content || historyResponse.result;
            if (Array.isArray(raw)) {
                historyItems = raw;
            } else if (typeof raw === 'string') {
                try { historyItems = JSON.parse(raw); } catch (e) { }
            }
        }

        // Slice last 20 items
        const recentHistory = historyItems.slice(-20);

        if (recentHistory.length === 0) {
            return res.json({ analysis: "No HTTP history found in Burp Proxy." });
        }

        // Format for AI
        const historyContext = recentHistory.map((item, idx) => {
            return `### Request #${idx + 1}
**URL**: ${item.url || 'N/A'}
**Method**: ${item.method || 'N/A'}
**Status**: ${item.status_code || 'N/A'}

**Request**:
\`\`\`http
${item.request || '(no content)'}
\`\`\`

**Response**:
\`\`\`http
${item.response_headers || ''}
...(body truncated)...
\`\`\`
--------------------------------------------------`;
        }).join('\n\n');

        // 2. Send to AI
        const systemPrompt = `You are an expert Application Security Engineer. 
        Analyze the following HTTP history logs (Last 20 requests) from Burp Suite.
        Identify potential security vulnerabilities (OWASP Top 10, etc).
        
        Focus on:
        - Sensitive data exposure (PII, tokens in URL/body)
        - Broken authentication/authorization
        - Injection points (SQLi, XSS, Command Injection)
        - Security misconfigurations (Missing headers, verbose errors)
        - Suspicious behavior
        
        Provide a concise, actionable summary of findings in Markdown format. 
        If specific requests look suspicious, reference them by number.
        If no obvious critical issues are found, state that clearly.`;

        console.log(`[BurpAnalysis] Sending ${recentHistory.length} items to AI (${provider}:${model})...`);

        const analysis = await AIService.generate(provider,
            `${systemPrompt}\n\n### HTTP HISTORY LOGS:\n${historyContext}`,
            { model }
        );

        res.json({ analysis });

    } catch (error) {
        console.error('[BurpAnalysis] Error:', error);
        res.status(500).json({ message: 'Analysis failed', error: error.message });
    }
};
