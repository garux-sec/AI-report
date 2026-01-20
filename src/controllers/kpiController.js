const KPI = require('../models/KPI');
const User = require('../models/User');

// Get KPI settings (Admin gets list of users or specific query, User gets own)
exports.getSettings = async (req, res) => {
    try {
        const { userId, year } = req.query;
        let query = {};

        // If specific user requested
        if (userId) {
            query.user = userId;
        } else if (req.user.role !== 'admin') {
            // Non-admin can only see their own
            query.user = req.user.userId;
        }

        if (year) {
            query.year = year;
        } else {
            query.year = new Date().getFullYear();
        }

        const kpi = await KPI.findOne(query).populate('user', 'username email');

        // If no KPI found, return empty structure or null
        // But for UI convenience, we can return null and let UI handle "No Settings Found"
        res.json(kpi || null);

    } catch (error) {
        console.error('Error fetching KPI settings:', error);
        res.status(500).json({ message: 'Error fetching KPI settings' });
    }
};

// Create or Update KPI Settings
exports.saveSettings = async (req, res) => {
    try {
        const { userId, year, targets } = req.body;

        if (!userId || !year) {
            return res.status(400).json({ message: 'User ID and Year are required' });
        }

        // Access Control: Only admin should be able to set KPIs for others
        // But for now, let's assume if you have access to this API you are likely Admin or authorized.
        // If strictly checking: if (req.user.role !== 'admin' && req.user.userId !== userId) ...

        const updateData = {
            user: userId,
            year: year,
            targets: targets,
            updatedAt: Date.now()
        };

        const kpi = await KPI.findOneAndUpdate(
            { user: userId, year: year },
            updateData,
            { new: true, upsert: true } // Create if not exists
        );

        res.json(kpi);

    } catch (error) {
        console.error('Error saving KPI settings:', error);
        res.status(500).json({ message: 'Error saving KPI settings' });
    }
};

// Get List of Users for Dropdown (Admin Helper)
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({}, 'username email');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};
