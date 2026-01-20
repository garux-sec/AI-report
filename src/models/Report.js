const mongoose = require('mongoose');

const VulnerabilitySchema = new mongoose.Schema({
    id: String, // internal ID if needed
    title: String,
    owasp: String,
    severity: {
        type: String,
        // enum: ['critical', 'high', 'medium', 'low', 'info', 'none'],
        default: 'low'
    },
    cvssVersion: String, // "3.1" or "4.0"
    cvssVector: String, // e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
    cvssScore: Number,
    detail: String, // Original detail
    new_detail: String, // AI enhanced detail or edited detail
    affected: String, // Affected URL/Component
    fix: String, // Recommendation/Fix
    status: {
        type: String,
        default: 'Open'
    },
    file: String // Base64 image or path
});

const ReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, // Owner of the report
        ref: 'User'
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: false // Optional for backward compatibility
    },
    frameworks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Framework'
    }],
    systemName: { type: String, required: true },
    url: String,
    format: String, // e.g., Blackbox, Whitebox
    environment: String, // e.g., Production, UAT
    startDate: Date,
    endDate: Date,
    info: {
        ip: String,
        domain: String,
        port: String,
        os: String,
        server: String
    },
    vulnerabilities: [VulnerabilitySchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Report', ReportSchema);
