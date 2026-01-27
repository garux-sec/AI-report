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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

SSHConfigSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('SSHConfig', SSHConfigSchema);
