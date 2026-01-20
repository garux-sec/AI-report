const mongoose = require('mongoose');
const Report = require('../models/Report');
const Project = require('../models/Project');
const KPI = require('../models/KPI');
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

        // 5. Calculate KPI Goals (Integrated)
        const currentYear = new Date().getFullYear();
        // console.log(`[KPI_DEBUG] Fetching KPI for User: ${userId}, Year: ${currentYear}`); // Cleaning up debug

        const kpiSettings = await KPI.findOne({ user: userId, year: currentYear });
        const goals = [];

        if (kpiSettings && kpiSettings.targets) {
            // console.log(`[KPI_DEBUG] Found Settings:`, kpiSettings ? 'YES' : 'NO'); // Cleaning up debug
            // console.log(`[KPI_DEBUG] Processing ${kpiSettings.targets.length} targets`); // Cleaning up debug
            for (const target of kpiSettings.targets) {
                let current = 0;
                const tagRegex = new RegExp(`^${target.tag}$`, 'i');

                if (target.metric === 'ReportsClosed') {
                    const closedReports = await Report.aggregate([
                        {
                            $match: {
                                user: new mongoose.Types.ObjectId(userId),
                                tags: { $in: [tagRegex] }
                            }
                        },
                        {
                            $project: {
                                hasOpenVulns: {
                                    $gt: [
                                        { $size: { $filter: { input: { $ifNull: ["$vulnerabilities", []] }, as: "v", cond: { $eq: ["$$v.status", "Open"] } } } },
                                        0
                                    ]
                                }
                            }
                        },
                        { $match: { hasOpenVulns: false } },
                        { $count: "count" }
                    ]);
                    current = closedReports.length > 0 ? closedReports[0].count : 0;

                } else if (target.metric === 'ReportsCompleted') {
                    current = await Report.countDocuments({ user: userId, tags: { $in: [tagRegex] } });

                } else if (target.metric === 'VulnerabilitiesFound') {
                    const vulns = await Report.aggregate([
                        { $match: { user: new mongoose.Types.ObjectId(userId), tags: { $in: [tagRegex] } } },
                        { $unwind: "$vulnerabilities" },
                        { $count: "count" }
                    ]);
                    current = vulns.length > 0 ? vulns[0].count : 0;
                }

                goals.push({
                    metric: target.metric,
                    tag: target.tag,
                    target: target.targetValue,
                    current: current,
                    percent: Math.min(100, Math.round((current / target.targetValue) * 100))
                });
            }
        }

        res.json({
            counts: {
                reports: totalReports,
                projects: totalProjects,
                vulnerabilities: vulnStats.total
            },
            vulnerabilities: vulnStats,
            recentRisks: topRisks,
            reportStats: reportStats,
            goals: goals
        });

    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ message: 'Error getting dashboard stats' });
    }
};

exports.getKpiStats = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Basic Counts & Severity Distribution (Reuse similar logic but optimized for KPI)
        const totalStats = await Report.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$vulnerabilities" },
            {
                $group: {
                    _id: null,
                    totalVulns: { $sum: 1 },
                    criticalCount: {
                        $sum: { $cond: [{ $regexMatch: { input: "$vulnerabilities.severity", regex: /^critical$/i } }, 1, 0] }
                    },
                    highCount: {
                        $sum: { $cond: [{ $regexMatch: { input: "$vulnerabilities.severity", regex: /^high$/i } }, 1, 0] }
                    },
                    mediumCount: {
                        $sum: { $cond: [{ $regexMatch: { input: "$vulnerabilities.severity", regex: /^medium$/i } }, 1, 0] }
                    },
                    lowCount: {
                        $sum: { $cond: [{ $regexMatch: { input: "$vulnerabilities.severity", regex: /^low$/i } }, 1, 0] }
                    }
                }
            }
        ]);

        const reportCount = await Report.countDocuments({ user: userId });

        // 2. Trends (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const trends = await Report.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            { $unwind: "$vulnerabilities" },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" }
                    },
                    count: { $sum: 1 },
                    criticals: {
                        $sum: { $cond: [{ $regexMatch: { input: "$vulnerabilities.severity", regex: /^critical$/i } }, 1, 0] }
                    }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // 3. Top Categories (Grouping by Vulnerability Title as a proxy for category)
        const categories = await Report.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$vulnerabilities" },
            {
                $group: {
                    _id: "$vulnerabilities.title",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Calculate Weighted Score
        // Crit=10, High=5, Med=2, Low=1
        let kpiData = {
            totalVulns: 0,
            critical: 0,
            reports: reportCount,
            avgScore: 0,
            severityDist: { Critical: 0, High: 0, Medium: 0, Low: 0 },
            trends: [],
            topCategories: []
        };

        if (totalStats.length > 0) {
            const s = totalStats[0];
            kpiData.totalVulns = s.totalVulns;
            kpiData.critical = s.criticalCount;
            kpiData.severityDist = {
                Critical: s.criticalCount,
                High: s.highCount,
                Medium: s.mediumCount,
                Low: s.lowCount
            };

            // Simple Score Calculation
            const weightedSum = (s.criticalCount * 10) + (s.highCount * 5) + (s.mediumCount * 2) + (s.lowCount * 1);
            kpiData.avgScore = s.totalVulns > 0 ? (weightedSum / s.totalVulns).toFixed(1) : 0;
        }

        // Format Trends for Frontend
        kpiData.trends = trends.map(t => ({
            label: `${t._id.month}/${t._id.year}`,
            count: t.count,
            criticals: t.criticals
        }));

        kpiData.topCategories = categories.map(c => ({
            name: c._id || 'Unknown',
            count: c.count
        }));

        // 4. Calculate Progress against KPI Targets
        const currentYear = new Date().getFullYear();
        const kpiSettings = await KPI.findOne({ user: userId, year: currentYear });

        kpiData.goals = [];

        if (kpiSettings && kpiSettings.targets) {
            for (const target of kpiSettings.targets) {
                let current = 0;
                const tagRegex = new RegExp(`^${target.tag}$`, 'i'); // Case-insensitive tag match

                if (target.metric === 'ReportsClosed') {
                    // Count reports with this tag where NO 'Open' vulnerabilities exist
                    // Reuse logic similar to reportStatusAgg but filtered by tag
                    const closedReports = await Report.aggregate([
                        {
                            $match: {
                                user: new mongoose.Types.ObjectId(userId),
                                tags: { $in: [tagRegex] }
                            }
                        },
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
                        { $match: { hasOpenVulns: false } },
                        { $count: "count" }
                    ]);
                    current = closedReports.length > 0 ? closedReports[0].count : 0;

                } else if (target.metric === 'ReportsCompleted') {
                    // Simply count reports with this tag
                    current = await Report.countDocuments({
                        user: userId,
                        tags: { $in: [tagRegex] }
                    });

                } else if (target.metric === 'VulnerabilitiesFound') {
                    // Count total vulnerabilities in reports with this tag
                    const vulns = await Report.aggregate([
                        {
                            $match: {
                                user: new mongoose.Types.ObjectId(userId),
                                tags: { $in: [tagRegex] }
                            }
                        },
                        { $unwind: "$vulnerabilities" },
                        { $count: "count" }
                    ]);
                    current = vulns.length > 0 ? vulns[0].count : 0;
                }

                kpiData.goals.push({
                    metric: target.metric,
                    tag: target.tag,
                    target: target.targetValue,
                    current: current,
                    percent: Math.min(100, Math.round((current / target.targetValue) * 100))
                });
            }
        }

        res.json(kpiData);

    } catch (error) {
        console.error('Error fetching KPI stats:', error);
        res.status(500).json({ message: 'Error fetching KPI stats' });
    }
};
