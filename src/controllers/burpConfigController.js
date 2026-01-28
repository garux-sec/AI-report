const BurpConfig = require('../models/BurpConfig');

exports.getConfigs = async (req, res) => {
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
