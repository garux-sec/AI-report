const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/dashboard.html'));
});

// New separated routes
router.get('/settings/frameworks.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/settings/frameworks.html'));
});

router.get('/settings/users.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/settings/users.html'));
});

router.get('/settings/ai-connections.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/settings/ai-connections.html'));
});

router.get('/projects.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/projects.html'));
});

router.get('/project-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/project-dashboard.html'));
});

router.get('/report-edit.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/report-edit.html'));
});

// Fallback (Redirect old settings to frameworks)
router.get('/settings.html', (req, res) => {
    res.redirect('/settings/frameworks.html');
});

// Handle root
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/index.html'));
});

// Serve any other html files in views simply
router.get('/:page', (req, res) => {
    const page = req.params.page;
    if (page.endsWith('.html')) {
        res.sendFile(path.join(__dirname, `../../public/views/${page}`));
    } else {
        res.sendFile(path.join(__dirname, '../../public/views/index.html'));
    }
});

module.exports = router;
