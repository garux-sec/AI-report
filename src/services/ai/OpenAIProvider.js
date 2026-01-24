const axios = require('axios');

class OpenAIProvider {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async generate(prompt, options = {}) {
        const apiKey = options.apiKey || this.apiKey;
        let baseUrl = options.baseUrl || this.baseUrl;

        if (!apiKey) {
            throw new Error("OpenAI API Key not configured.");
        }

        // Ensure proper endpoint for OpenAI-compatible APIs
        if (baseUrl && !baseUrl.includes('/chat/completions')) {
            // Remove trailing slash if present
            if (baseUrl.endsWith('/')) {
                baseUrl = baseUrl.slice(0, -1);
            }
            baseUrl = `${baseUrl}/chat/completions`;
        }

        console.log("---------------------------------------------------");
        console.log("DEBUG: OpenAI Provider Config");
        console.log("API Key:", apiKey);
        console.log("Base URL:", baseUrl);
        console.log("---------------------------------------------------");

        try {
            const response = await axios.post(baseUrl, {
                model: options.model || "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("OpenAI API Error Details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new Error(`Failed to generate text from OpenAI. Error: ${errorMessage}`);
        }
    }
}

module.exports = OpenAIProvider;
