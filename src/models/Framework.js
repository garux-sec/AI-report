const mongoose = require('mongoose');

const FrameworkItemSchema = new mongoose.Schema({
    code: String, // e.g. A01:2021
    title: String, // e.g. Broken Access Control
    description: String
});

const FrameworkSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    year: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Web', 'API', 'LLM', 'Mobile', 'IoT', 'Other'],
        required: true
    },
    items: [FrameworkItemSchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index to prevent duplicates
FrameworkSchema.index({ name: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Framework', FrameworkSchema);
