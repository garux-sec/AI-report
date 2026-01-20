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
