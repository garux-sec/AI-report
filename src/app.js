const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');

// Load environment variables (optional, good practice)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 9000;

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use((req, res, next) => {
    console.log(`[DEBUG_REQ] ${req.method} ${req.url}`);
    next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const viewRoutes = require('./routes/viewRoutes');

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

// 404 Handler
app.use((req, res, next) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '../public/views/index.html')); // Redirect to login/home on 404 for SPA feel? Or just 404.
        return;
    }
    res.status(404).json({ message: 'Resource not found' });
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
