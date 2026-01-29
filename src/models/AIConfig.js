const mongoose = require('mongoose');

const AIConfigSchema = new mongoose.Schema({
    provider: {
        type: String,
        enum: ['openai', 'ollama', 'anthropic', 'gemini', 'other'],
        required: true
    },
    name: String, // Friendly name e.g. "My Ollama"
    apiKey: String,
    baseUrl: String, // For Ollama or custom endpoints
    modelName: String, // Default model to use e.g. "gpt-4", "llama2"
    isEnabled: {
        type: Boolean,
        default: false
    },
    isDefault: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('AIConfig', AIConfigSchema);
