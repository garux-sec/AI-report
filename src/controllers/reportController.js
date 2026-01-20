const mongoose = require('mongoose');
const Report = require('../models/Report');
const PDFService = require('../services/PDFService');

exports.createReport = async (req, res) => {
    try {
        const reportData = { ...req.body, user: req.user.userId };
        const report = new Report(reportData);
        await report.save();
        res.status(201).json({ message: 'Report created successfully', reportId: report._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating report: ' + error.message });
    }
};

exports.getReports = async (req, res) => {
    try {
        const query = { user: req.user.userId };
        if (req.query.projectId) {
            query.project = req.query.projectId;
        }

        const reports = await Report.find(query).sort({ createdAt: -1 });
        res.json(reports);
    } catch (error) {
        console.error(error); // Debug log
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getReportById = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching report' });
    }
};

exports.updateReport = async (req, res) => {
    try {
        console.log('[updateReport] Request body:', JSON.stringify(req.body, null, 2));
        console.log('[updateReport] Tags in body:', req.body.tags);
        console.log('[updateReport] Frameworks in body:', req.body.frameworks);

        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('frameworks');

        if (!report) return res.status(404).json({ message: 'Report not found' });

        console.log('[updateReport] Updated report tags:', report.tags);
        console.log('[updateReport] Updated report frameworks:', report.frameworks);

        res.json(report);
    } catch (error) {
        console.error('[updateReport] Error:', error);
        res.status(500).json({ message: 'Error updating report: ' + error.message });
    }
};

exports.generatePDF = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });

        PDFService.generateReport(report, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating PDF' });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const report = await Report.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
        if (!report) return res.status(404).json({ message: 'Report not found or unauthorized' });
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting report' });
    }
};

exports.getAllTags = async (req, res) => {
    try {
        console.log('[getAllTags] Starting to fetch tags for user:', req.user.userId);

        // Get all unique tags from reports belonging to the user
        const reports = await Report.find({ user: req.user.userId }).select('tags');

        console.log('[getAllTags] Found', reports.length, 'reports');

        // Flatten and get unique tags
        const allTags = reports.reduce((acc, report) => {
            if (report.tags && Array.isArray(report.tags)) {
                report.tags.forEach(tag => {
                    if (tag && !acc.includes(tag)) {
                        acc.push(tag);
                    }
                });
            }
            return acc;
        }, []);

        console.log('[getAllTags] Found', allTags.length, 'unique tags:', allTags);

        // Sort alphabetically
        allTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        res.json(allTags);
    } catch (error) {
        console.error('[getAllTags] Error:', error);
        res.status(500).json({ message: 'Error fetching tags' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.userId;
        const Project = require('../models/Project'); // Need Project model

        // 1. Total counts
        const totalReports = await Report.countDocuments({ user: userId });
        const totalProjects = await Project.countDocuments({ user: userId }); // Assuming Project model has user field

        // 2. Vulnerability Stats (Aggregation)
        const stats = await Report.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$vulnerabilities" },
            {
                $group: {
                    _id: null,
                    totalVulns: { $sum: 1 },
                    bySeverity: {
                        $push: "$vulnerabilities.severity"
                    },
                    byStatus: {
                        $push: "$vulnerabilities.status"
                    }
                }
            }
        ]);

        // 3. Top 5 Latest Critical/High Vulnerabilities
        const topRisks = await Report.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$vulnerabilities" },
            {
                $match: {
                    "vulnerabilities.severity": { $regex: /^(critical|high)$/i }
                }
            },
            { $sort: { "createdAt": -1 } },
            { $limit: 5 },
            {
                $project: {
                    systemName: 1,
                    title: "$vulnerabilities.title",
                    severity: "$vulnerabilities.severity",
                    status: "$vulnerabilities.status",
                    date: "$createdAt"
                }
            }
        ]);

        // 4. Reports by Status Aggregation (Derived)
        // A report is "Open" if it has at least one vulnerability with status "Open"
        const reportStatusAgg = await Report.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            {
                $project: {
                    hasOpenVulns: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: { $ifNull: ["$vulnerabilities", []] },
                                        as: "v",
                                        cond: { $eq: ["$$v.status", "Open"] }
                                    }
                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$hasOpenVulns",
                    count: { $sum: 1 }
                }
            }
        ]);

        let reportStats = { Open: 0, Fixed: 0 };
        reportStatusAgg.forEach(doc => {
            if (doc._id === true) reportStats.Open = doc.count;
            else reportStats.Fixed = doc.count;
        });

        let vulnStats = {
            total: 0,
            severity: { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 },
            status: { Open: 0, Closed: 0, Remediated: 0, Accepted: 0 }
        };

        if (stats.length > 0) {
            vulnStats.total = stats[0].totalVulns;

            // Process Severity
            stats[0].bySeverity.forEach(sev => {
                // Normalize string (e.g. "high" -> "High")
                const s = sev ? sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase() : 'Info';
                if (vulnStats.severity[s] !== undefined) {
                    vulnStats.severity[s]++;
                } else {
                    // Fallback for unexpected values
                    vulnStats.severity['Info'] = (vulnStats.severity['Info'] || 0) + 1;
                }
            });

            // Process Status
            stats[0].byStatus.forEach(status => {
                const s = status || 'Open';
                if (vulnStats.status[s] !== undefined) {
                    vulnStats.status[s]++;
                } else {
                    vulnStats.status['Open'] = (vulnStats.status['Open'] || 0) + 1;
                }
            });
        }

        res.json({
            counts: {
                reports: totalReports,
                projects: totalProjects,
                vulnerabilities: vulnStats.total
            },
            vulnerabilities: vulnStats,
            recentRisks: topRisks,
            reportStats: reportStats
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
};
