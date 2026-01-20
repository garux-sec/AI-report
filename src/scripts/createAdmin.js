const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');
require('dotenv').config();

const createAdmin = async () => {
    await connectDB();

    const username = 'admin';
    const password = 'P@ssw0rd';

    try {
        let user = await User.findOne({ username });
        if (user) {
            console.log('Admin user already exists.');
            // Update password just in case
            user.password = password;
            // Note: In a real app we might not want to overwrite, but here user asked to create it.
            // However, the model pre-save hook handles hashing. 
            // If we just set it, we need to save.
            // But pre-save checks `isModified`.
            await user.save();
            console.log('Admin password updated.');
        } else {
            user = new User({ username, password, role: 'admin' });
            await user.save();
            console.log('Admin user created successfully.');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        mongoose.connection.close();
    }
};

createAdmin();
