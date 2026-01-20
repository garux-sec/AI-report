const mongoose = require('mongoose');

const JPISchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    year: { type: Number, required: true, default: new Date().getFullYear() },
    targets: [{
        metric: {
            type: String,
            enum: ['ReportsClosed', 'ReportsCompleted', 'VulnerabilitiesFound'],
            default: 'ReportsClosed'
        },
        tag: { type: String }, // e.g., 'pentest2026'
        targetValue: { type: Number, required: true },
        description: { type: String }
    }],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('KPI', JPISchema);
