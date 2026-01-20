const express = require('express');
console.log('LOADING API ROUTES...');
const router = express.Router();

router.get('/ping', (req, res) => {
    console.log('PING HIT');
    res.json({ message: 'pong-updated' });
});
const reportController = require('../controllers/reportController');
const aiController = require('../controllers/aiController');
const frameworkController = require('../controllers/frameworkController');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_this';

// Auth Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ message: 'Token is not valid' });
    }
};

// Report Routes
router.use('/reports', (req, res, next) => {
    console.log('[API_DEBUG] Hit /reports middleware', req.method, req.url);
    next();
});
router.post('/reports', auth, reportController.createReport);
router.get('/reports/tags', auth, reportController.getAllTags);
router.get('/reports', auth, reportController.getReports);
router.get('/reports/:id', auth, reportController.getReportById);
router.get('/reports/:id/pdf', auth, reportController.generatePDF);
router.put('/reports/:id', auth, reportController.updateReport);
router.post('/reports/:id/update', auth, reportController.updateReport); // Alias for PUT workaround
router.delete('/reports/:id', auth, reportController.deleteReport);

// AI Routes
router.post('/ai/generate', auth, aiController.generateText);

// Framework Routes
router.get('/frameworks', auth, frameworkController.getFrameworks);
router.post('/frameworks', auth, frameworkController.createFramework);
router.put('/frameworks/:id', auth, frameworkController.updateFramework);
router.delete('/frameworks/:id', auth, frameworkController.deleteFramework);

// Debug Route
router.get('/ping', (req, res) => res.json({ message: 'pong' }));

router.get('/debug/routes', (req, res) => {
    const routes = [];
    router.stack.forEach(middleware => {
        if (middleware.route) { // routes registered directly on the router
            routes.push({
                path: middleware.route.path,
                methods: middleware.route.methods
            });
        }
    });
    res.json(routes);
});

// User Routes
const userController = require('../controllers/userController');
router.get('/users', auth, userController.getUsers);
router.post('/users', auth, userController.createUser);
router.put('/users/:id', auth, userController.updateUser);
router.delete('/users/:id', auth, userController.deleteUser);

// AI Config Routes
const aiConfigController = require('../controllers/aiConfigController');
router.get('/ai-config', auth, aiConfigController.getConfigs);
router.post('/ai-config', auth, aiConfigController.createConfig);
router.put('/ai-config/:id', auth, aiConfigController.updateConfig);
router.delete('/ai-config/:id', auth, aiConfigController.deleteConfig);
router.delete('/ai-config/:id', auth, aiConfigController.deleteConfig);
router.post('/ai-config/:id/default', auth, aiConfigController.setDefault);
router.post('/ai-config/fetch-models', auth, aiConfigController.fetchModels);

// Multer for Project Assets
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/uploads/projects');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Project Routes
const projectController = require('../controllers/projectController');
router.get('/projects', auth, projectController.getProjects);
router.get('/projects/:id', auth, projectController.getProjectById);
router.post('/projects', auth, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'background', maxCount: 1 }]), projectController.createProject);
router.put('/projects/:id', auth, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'background', maxCount: 1 }]), projectController.updateProject);
router.post('/projects/:id/clone', auth, projectController.cloneProject);
router.delete('/projects/:id', auth, projectController.deleteProject);

console.log('API ROUTES LOADED.');
module.exports = router;
