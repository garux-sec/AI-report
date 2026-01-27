const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String
    },
    clientName: {
        type: String
    },
    preparedBy: String,
    pentesterName: String,
    pentesterPosition: String,
    pentesterEmail: String,
    logoUrl: String, // Path to uploaded logo
    backgroundUrl: String, // Path to uploaded background
    targets: [{
        name: { type: String, required: true },
        url: { type: String },
        appClass: { type: String },
        bu: { type: String },
        it: { type: String },
        remarks: { type: String }
    }],
    status: {
        type: String,
        enum: ['active', 'archived', 'completed'],
        default: 'active'
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

// Update updated_at on save
// Update updated_at on save
ProjectSchema.pre('save', async function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Project', ProjectSchema);
