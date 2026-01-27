const SSHConfig = require('../models/SSHConfig');
const { Client } = require('ssh2');

exports.getConfigs = async (req, res) => {
    try {
        const configs = await SSHConfig.find().sort({ createdAt: -1 });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching SSH configs' });
    }
};

exports.createConfig = async (req, res) => {
    try {
        const count = await SSHConfig.countDocuments();
        const config = new SSHConfig({
            ...req.body,
            isDefault: count === 0
        });
        await config.save();
        res.status(201).json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error creating SSH config', error: error.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const config = await SSHConfig.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error updating SSH config' });
    }
};

exports.deleteConfig = async (req, res) => {
    try {
        await SSHConfig.findByIdAndDelete(req.params.id);
        res.json({ message: 'SSH Config deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting SSH config' });
    }
};

exports.testConnection = async (req, res) => {
    const { host, port, username, password, privateKey, passphrase } = req.body;
    const conn = new Client();

    conn.on('ready', () => {
        conn.end();
        res.json({ success: true, message: 'SSH Connection Successful!' });
    }).on('error', (err) => {
        res.status(500).json({ success: false, message: 'SSH Connection Failed: ' + err.message });
    }).connect({
        host: host || '127.0.0.1',
        port: port || 22,
        username: username,
        password: password,
        privateKey: privateKey,
        passphrase: passphrase,
        readyTimeout: 10000
    });
};

exports.setDefault = async (req, res) => {
    try {
        await SSHConfig.updateMany({}, { isDefault: false });
        const config = await SSHConfig.findByIdAndUpdate(req.params.id, { isDefault: true }, { new: true });
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error setting default SSH config' });
    }
};
