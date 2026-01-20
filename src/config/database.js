const mongoose = require('mongoose');

// Default URI based on the user's original code
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:55000/RAG_CYBER";

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            // useNewUrlParser: true, // Deprecated in newer mongoose, but good for older versions
            // useUnifiedTopology: true
        });
        console.log(`MongoDB Connected: ${MONGO_URI}`);
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;
