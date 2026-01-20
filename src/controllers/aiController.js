const AIService = require('../services/AIService');

exports.generateText = async (req, res) => {
    try {
        const { provider, prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ message: "Prompt is required" });
        }

        const result = await AIService.generate(provider, prompt, { model });
        res.json({ result });
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ message: error.message });
    }
};
