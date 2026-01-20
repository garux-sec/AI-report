const axios = require('axios');

class OllamaProvider {
    constructor() {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
    }

    async generate(prompt, options = {}) {
        try {
            const response = await axios.post(this.baseUrl, {
                model: options.model || "llama2", // Make sure user has this model pulled
                prompt: prompt,
                stream: false
            });

            return response.data.response;
        } catch (error) {
            console.error("Ollama API Error:", error.response?.data || error.message);
            throw new Error("Failed to generate text from Ollama. Ensure Ollama is running.");
        }
    }
}

module.exports = OllamaProvider;
