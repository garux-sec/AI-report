const mongoose = require('mongoose');

const SSHConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    host: {
        type: String,
        required: true,
        trim: true
    },
    port: {
        type: Number,
        default: 22
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        trim: true
    },
    privateKey: {
        type: String,
        trim: true
    },
    passphrase: {
        type: String,
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    enabled: {
        type: Boolean,
        default: true
    },
    lastStatus: {
        type: String,
        enum: ['online', 'offline', 'disabled', 'unknown'],
        default: 'unknown'
    },
    lastChecked: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

SSHConfigSchema.pre('save', async function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('SSHConfig', SSHConfigSchema);
