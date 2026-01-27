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

// Execute a command on a Kali machine
exports.executeCommand = async (req, res) => {
    const { command, configId } = req.body;

    if (!command) {
        return res.status(400).json({ success: false, message: 'Command is required' });
    }

    try {
        // Get SSH config
        const config = await SSHConfig.findById(configId);
        if (!config) {
            return res.status(404).json({ success: false, message: 'Kali Runner not found' });
        }

        if (!config.enabled) {
            return res.status(400).json({
                success: false,
                message: 'Kali Runner is disabled. Please enable it first.',
                disabled: true
            });
        }

        const conn = new Client();
        let output = '';
        let errorOutput = '';

        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                conn.end();
                resolve({
                    success: true,
                    output: output || 'Command timed out (30s)',
                    timedOut: true
                });
            }, 30000); // 30 second timeout

            conn.on('ready', () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        clearTimeout(timeout);
                        reject(err);
                        return;
                    }

                    stream.on('close', (code, signal) => {
                        clearTimeout(timeout);
                        conn.end();
                        resolve({
                            success: code === 0 || code === null,
                            output: output + errorOutput,
                            exitCode: code
                        });
                    }).on('data', (data) => {
                        output += data.toString();
                    }).stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                });
            }).on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            }).connect({
                host: config.host || '127.0.0.1',
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
                passphrase: config.passphrase,
                readyTimeout: 10000
            });
        });

        res.json({
            success: result.success,
            output: result.output,
            command: command,
            kaliRunner: config.name,
            kaliRunnerId: config._id,
            executedAt: new Date()
        });

    } catch (error) {
        console.error('Execute Command Error:', error);
        res.status(500).json({
            success: false,
            message: 'Command execution failed: ' + error.message,
            output: error.message
        });
    }
};
