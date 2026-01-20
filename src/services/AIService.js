const OpenAIProvider = require('./ai/OpenAIProvider');
const OllamaProvider = require('./ai/OllamaProvider');

class AIService {
    constructor() {
        this.providers = {
            openai: new OpenAIProvider(),
            ollama: new OllamaProvider()
        };
    }

    getProvider(providerName) {
        const provider = this.providers[providerName];
        if (!provider) {
            throw new Error(`AI Provider '${providerName}' not supported.`);
        }
        return provider;
    }

    async generate(providerName, prompt, options = {}) {
        const provider = this.getProvider(providerName || 'ollama'); // Default to Ollama
        return await provider.generate(prompt, options);
    }
}

module.exports = new AIService();
