const Project = require('../models/Project');
const Report = require('../models/Report');

exports.getProjects = async (req, res) => {
    try {
        const query = { user: req.user.userId };
        const projects = await Project.find(query).sort({ updatedAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects' });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await Project.findOne({ _id: req.params.id, user: req.user.userId });
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching project' });
    }
};

exports.createProject = async (req, res) => {
    try {
        console.log('Create Project Body:', req.body);
        console.log('Create Project Files:', req.files);

        const projectData = {
            ...req.body,
            user: req.user.userId // Auto-assign current user
        };
        if (req.files) {
            if (req.files.logo) projectData.logoUrl = '/uploads/projects/' + req.files.logo[0].filename;
            if (req.files.background) projectData.backgroundUrl = '/uploads/projects/' + req.files.background[0].filename;
        }

        const project = new Project(projectData);
        await project.save();
        res.status(201).json(project);
    } catch (error) {
        console.error('Create Project Error:', error);
        res.status(400).json({ message: 'Error creating project', error: error.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const projectData = { ...req.body };
        if (req.files) {
            if (req.files.logo) projectData.logoUrl = '/uploads/projects/' + req.files.logo[0].filename;
            if (req.files.background) projectData.backgroundUrl = '/uploads/projects/' + req.files.background[0].filename;
        }

        const project = await Project.findByIdAndUpdate(req.params.id, projectData, { new: true });
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating project' });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        // Cascade delete: delete all reports associated with this project
        await Report.deleteMany({ project: req.params.id });

        await Project.findByIdAndDelete(req.params.id);
        res.json({ message: 'Project and associated reports deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting project' });
    }
};

exports.cloneProject = async (req, res) => {
    try {
        const originalProject = await Project.findById(req.params.id);
        if (!originalProject) return res.status(404).json({ message: 'Project not found' });

        const newProjectData = originalProject.toObject();
        delete newProjectData._id;
        delete newProjectData.createdAt;
        delete newProjectData.updatedAt;
        delete newProjectData.__v;

        newProjectData.name = `${originalProject.name} (Clone)`;
        newProjectData.status = 'active'; // Reset status for clone

        const newProject = new Project(newProjectData);
        await newProject.save();

        res.status(201).json(newProject);
    } catch (error) {
        console.error('Clone Project Error:', error);
        res.status(500).json({ message: 'Error cloning project', error: error.message });
    }
};

// Target Management
exports.addTarget = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        project.targets.push(req.body);
        await project.save();

        res.status(201).json(project);
    } catch (error) {
        console.error('Add Target Error:', error);
        res.status(500).json({ message: 'Error adding target', error: error.message });
    }
};

exports.updateTarget = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        Object.assign(target, req.body);
        await project.save();

        res.json(project);
    } catch (error) {
        console.error('Update Target Error:', error);
        res.status(500).json({ message: 'Error updating target', error: error.message });
    }
};

exports.deleteTarget = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        project.targets.pull(req.params.targetId);
        await project.save();

        res.json(project);
    } catch (error) {
        console.error('Delete Target Error:', error);
        res.status(500).json({ message: 'Error deleting target', error: error.message });
    }
};

exports.importTargetsCSV = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const { targets } = req.body;
        if (!Array.isArray(targets)) {
            return res.status(400).json({ message: 'Invalid targets data' });
        }

        // Append imported targets
        targets.forEach(target => {
            if (target.name) {
                project.targets.push({
                    name: target.name || '',
                    url: target.url || '',
                    appClass: target.appClass || '',
                    bu: target.bu || '',
                    it: target.it || '',
                    remarks: target.remarks || ''
                });
            }
        });

        await project.save();
        res.json({ message: `Imported ${targets.length} targets`, project });
    } catch (error) {
        console.error('Import Targets Error:', error);
        res.status(500).json({ message: 'Error importing targets', error: error.message });
    }
};

// Get single target
exports.getTarget = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        res.json({ target, project: { _id: project._id, name: project.name } });
    } catch (error) {
        console.error('Get Target Error:', error);
        res.status(500).json({ message: 'Error fetching target', error: error.message });
    }
};

// Update target notes
exports.updateTargetNotes = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        target.notes = req.body.notes || '';
        await project.save();

        res.json({ message: 'Notes updated', target });
    } catch (error) {
        console.error('Update Notes Error:', error);
        res.status(500).json({ message: 'Error updating notes', error: error.message });
    }
};

// Save command result to target
exports.saveCommandResult = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        const { command, output, kaliRunner, kaliRunnerId, status } = req.body;

        target.commandResults.push({
            command,
            output,
            kaliRunner,
            kaliRunnerId,
            status: status || 'success',
            executedAt: new Date()
        });

        await project.save();

        res.json({ message: 'Command result saved', target });
    } catch (error) {
        console.error('Save Command Result Error:', error);
        res.status(500).json({ message: 'Error saving command result', error: error.message });
    }
};

// Upload image to target
exports.uploadTargetImage = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        target.images.push({
            filename: req.file.originalname,
            path: '/uploads/targets/' + req.file.filename,
            description: req.body.description || '',
            uploadedAt: new Date()
        });

        await project.save();

        res.json({ message: 'Image uploaded', target });
    } catch (error) {
        console.error('Upload Image Error:', error);
        res.status(500).json({ message: 'Error uploading image', error: error.message });
    }
};

// Delete image from target
exports.deleteTargetImage = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        target.images.pull(req.params.imageId);
        await project.save();

        res.json({ message: 'Image deleted', target });
    } catch (error) {
        console.error('Delete Image Error:', error);
        res.status(500).json({ message: 'Error deleting image', error: error.message });
    }
};

// Toggle target star status
exports.toggleTargetStar = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const target = project.targets.id(req.params.targetId);
        if (!target) return res.status(404).json({ message: 'Target not found' });

        target.isStarred = !target.isStarred;
        await project.save();

        res.json({ message: `Target ${target.isStarred ? 'starred' : 'unstarred'}`, target });
    } catch (error) {
        console.error('Toggle Star Error:', error);
        res.status(500).json({ message: 'Error toggling star', error: error.message });
    }
};
