const Project = require('../models/Project');
const Report = require('../models/Report');

exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find().sort({ updatedAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects' });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
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

        const projectData = { ...req.body };
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
        // Option: Check if reports exist before deleting? For now, we'll allow it but maybe warn in UI.
        await Project.findByIdAndDelete(req.params.id);
        // Optional: Delete or unlink associated reports
        // await Report.updateMany({ projectId: req.params.id }, { $unset: { projectId: 1 } });
        res.json({ message: 'Project deleted' });
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
