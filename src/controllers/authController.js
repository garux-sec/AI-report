const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_this';

exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ username, password });
        await user.save();

        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({ message: 'User registered successfully', token, user: { username: user.username, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.validatePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: 'Login successful', token, user: { username: user.username, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getMe = async (req, res) => {
    // Middleware should attach user to req
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
};
