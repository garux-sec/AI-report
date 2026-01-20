const Framework = require('../models/Framework');

exports.getFrameworks = async (req, res) => {
    try {
        const frameworks = await Framework.find().sort({ year: -1 });
        res.json(frameworks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching frameworks' });
    }
};

exports.createFramework = async (req, res) => {
    try {
        const framework = new Framework(req.body);
        await framework.save();
        res.status(201).json(framework);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Framework already exists' });
        }
        res.status(500).json({ message: 'Error creating framework', error: error.message });
    }
};

exports.updateFramework = async (req, res) => {
    try {
        const framework = await Framework.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!framework) return res.status(404).json({ message: 'Framework not found' });
        res.json(framework);
    } catch (error) {
        res.status(500).json({ message: 'Error updating framework' });
    }
};

exports.deleteFramework = async (req, res) => {
    try {
        const framework = await Framework.findByIdAndDelete(req.params.id);
        if (!framework) return res.status(404).json({ message: 'Framework not found' });
        res.json({ message: 'Framework deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting framework' });
    }
};
