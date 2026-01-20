const User = require('../models/User');

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ username: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ username, password, role: role || 'user' });
        await user.save();

        res.status(201).json({ message: 'User created successfully', user: { username: user.username, role: user.role } });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { username, role, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (username) user.username = username;
        if (role) user.role = role;
        if (password) user.password = password; // Pre-save hook will hash this

        await user.save();
        res.json({ message: 'User updated', user: { username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user' });
    }
};
