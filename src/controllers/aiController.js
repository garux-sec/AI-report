const AIService = require('../services/AIService');
const AIConfig = require('../models/AIConfig');

exports.generateText = async (req, res) => {
    try {
        const { provider, prompt, model, apiKey, baseUrl } = req.body;

        if (!prompt) {
            return res.status(400).json({ message: "Prompt is required" });
        }

        // 1. Initialize options from request body (highest priority)
        const options = {
            model,
            apiKey,
            baseUrl
        };

        // 2. Fallback to DB config if apiKey or baseUrl are missing
        if (!options.apiKey || !options.baseUrl) {
            let config = await AIConfig.findOne({ isDefault: true });

            // If no default, try to find by provider (case-insensitive)
            if (!config && provider) {
                config = await AIConfig.findOne({
                    provider: { $regex: new RegExp(`^${provider}$`, 'i') }
                });
            }

            // If still no config, get any enabled config
            if (!config) {
                config = await AIConfig.findOne({ isEnabled: true });
            }

            if (config) {
                if (!options.apiKey && config.apiKey) options.apiKey = config.apiKey;
                if (!options.baseUrl && config.baseUrl) options.baseUrl = config.baseUrl;
                if (!options.model && config.modelName) options.model = config.modelName;
            }
        }

        const result = await AIService.generate(provider, prompt, options);
        res.json({ result });
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ message: error.message });
    }
};
