const express = require('express');
console.log('LOADING API ROUTES...');
const router = express.Router();

router.get('/ping', (req, res) => {
    console.log('PING HIT');
    res.json({ message: 'pong-updated' });
});

const authMiddleware = require('../middleware/authMiddleware');
const projectController = require('../controllers/projectController');
const reportController = require('../controllers/reportController');
const aiController = require('../controllers/aiController');
const frameworkController = require('../controllers/frameworkController');
const kpiController = require('../controllers/kpiController');
const userController = require('../controllers/userController');
const aiConfigController = require('../controllers/aiConfigController');
const sshController = require('../controllers/sshController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Report Routes
router.use('/reports', (req, res, next) => {
    console.log('[API_DEBUG] Hit /reports middleware', req.method, req.url);
    next();
});
router.post('/reports', authMiddleware, reportController.createReport);
router.get('/reports/tags', authMiddleware, reportController.getAllTags);
router.get('/reports', authMiddleware, reportController.getReports);
router.get('/dashboard-stats', authMiddleware, reportController.getDashboardStats);
router.get('/kpi-stats', authMiddleware, reportController.getKpiStats);

// KPI Settings Routes
router.get('/kpi/settings', authMiddleware, kpiController.getSettings);
router.post('/kpi/settings', authMiddleware, kpiController.saveSettings);
router.get('/kpi/users', authMiddleware, kpiController.getUsers);

router.get('/reports/:id', authMiddleware, reportController.getReportById);
router.get('/reports/:id/pdf', authMiddleware, reportController.generatePDF);
router.put('/reports/:id', authMiddleware, reportController.updateReport);
router.post('/reports/:id/update', authMiddleware, reportController.updateReport);
router.delete('/reports/:id', authMiddleware, reportController.deleteReport);

// AI Routes
router.post('/ai/generate', authMiddleware, aiController.generateText);

// Framework Routes
router.get('/frameworks', authMiddleware, frameworkController.getFrameworks);
router.post('/frameworks', authMiddleware, frameworkController.createFramework);
router.put('/frameworks/:id', authMiddleware, frameworkController.updateFramework);
router.delete('/frameworks/:id', authMiddleware, frameworkController.deleteFramework);

// Debug Route
router.get('/ping', (req, res) => res.json({ message: 'pong' }));

router.get('/debug/routes', (req, res) => {
    const routes = [];
    router.stack.forEach(middleware => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: middleware.route.methods
            });
        }
    });
    res.json(routes);
});

// User Routes
router.get('/users', authMiddleware, userController.getUsers);
router.post('/users', authMiddleware, userController.createUser);
router.put('/users/:id', authMiddleware, userController.updateUser);
router.delete('/users/:id', authMiddleware, userController.deleteUser);

// AI Config Routes
router.get('/ai-config', authMiddleware, aiConfigController.getConfigs);
router.post('/ai-config', authMiddleware, aiConfigController.createConfig);
router.put('/ai-config/:id', authMiddleware, aiConfigController.updateConfig);
router.delete('/ai-config/:id', authMiddleware, aiConfigController.deleteConfig);
router.post('/ai-config/:id/default', authMiddleware, aiConfigController.setDefault);
router.post('/ai-config/fetch-models', authMiddleware, aiConfigController.fetchModels);

// SSH Config Routes
router.get('/ssh-config', authMiddleware, sshController.getConfigs);
router.post('/ssh-config', authMiddleware, sshController.createConfig);
router.put('/ssh-config/:id', authMiddleware, sshController.updateConfig);
router.delete('/ssh-config/:id', authMiddleware, sshController.deleteConfig);
router.post('/ssh-config/test', authMiddleware, sshController.testConnection);
router.post('/ssh-config/:id/default', authMiddleware, sshController.setDefault);

// Multer for Project Assets
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
router.get('/projects', authMiddleware, projectController.getProjects);
router.get('/projects/:id', authMiddleware, projectController.getProjectById);
router.post('/projects', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'background', maxCount: 1 }]), projectController.createProject);
router.put('/projects/:id', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'background', maxCount: 1 }]), projectController.updateProject);
router.post('/projects/:id/clone', authMiddleware, projectController.cloneProject);
router.delete('/projects/:id', authMiddleware, projectController.deleteProject);

// Project Target Routes
router.post('/projects/:id/targets', authMiddleware, projectController.addTarget);
router.get('/projects/:id/targets/:targetId', authMiddleware, projectController.getTarget);
router.put('/projects/:id/targets/:targetId', authMiddleware, projectController.updateTarget);
router.delete('/projects/:id/targets/:targetId', authMiddleware, projectController.deleteTarget);
router.post('/projects/:id/targets/import', authMiddleware, projectController.importTargetsCSV);
router.put('/projects/:id/targets/:targetId/notes', authMiddleware, projectController.updateTargetNotes);
router.post('/projects/:id/targets/:targetId/command', authMiddleware, projectController.saveCommandResult);
router.put('/projects/:id/targets/:targetId/star', authMiddleware, projectController.toggleTargetStar);

// Multer for Target Images
const targetImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/uploads/targets');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const targetImageUpload = multer({ storage: targetImageStorage });

// Target Image Routes
router.post('/projects/:id/targets/:targetId/images', authMiddleware, targetImageUpload.single('image'), projectController.uploadTargetImage);
router.delete('/projects/:id/targets/:targetId/images/:imageId', authMiddleware, projectController.deleteTargetImage);

// SSH Execute Command
router.post('/ssh-config/execute', authMiddleware, sshController.executeCommand);

console.log('API ROUTES LOADED.');
module.exports = router;
