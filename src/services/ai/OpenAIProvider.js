const axios = require('axios');

class OpenAIProvider {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async generate(prompt, options = {}) {
        if (!this.apiKey) {
            throw new Error("OpenAI API Key not configured.");
        }

        try {
            const response = await axios.post(this.baseUrl, {
                model: options.model || "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("OpenAI API Error:", error.response?.data || error.message);
            throw new Error("Failed to generate text from OpenAI.");
        }
    }
}

module.exports = OpenAIProvider;
