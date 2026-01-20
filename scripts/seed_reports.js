const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Models
const Project = require('../src/models/Project');
const Report = require('../src/models/Report');
const User = require('../src/models/User'); // Import User model

// Config
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:55000/RAG_CYBER";

const SYSTEM_PREFIXES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Core', 'Legacy', 'New', 'Payment', 'User', 'Admin'];
const SYSTEM_SUFFIXES = ['Service', 'Portal', 'API', 'Gateway', 'Mainframe', 'Dashboard', 'Connector', 'Auth', 'DB'];
const VULN_NAMES = ['SQL Injection', 'XSS Reflection', 'Insecure Deserialization', 'Weak Password', 'Open Port', 'Outdated Library', 'Missing Headers', 'CSRF Token Missing'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const STATUSES = ['Open', 'Fixed', 'Fixed', 'Fixed', 'Remediated', 'Accepted', 'False Positive']; // Weighted towards Fixed/Open

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomDate = () => {
    const start = new Date(2025, 0, 1);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // 0. Get a User (to assign ownership)
        const user = await User.findOne({});
        if (!user) {
            console.log('No user found! Please register a user first.');
            process.exit(1);
        }
        console.log(`Assigning reports to User: ${user.username} (${user._id})`);

        // 1. Get Specific Project
        const targetProjectId = '696dafee71485ae0fdf68601';
        let project = await Project.findById(targetProjectId);

        if (!project) {
            console.log(`Project ${targetProjectId} not found in DB! Aborting.`);
            process.exit(1);
        }
        console.log(`Using Project: ${project.name} (${project._id})`);

        // 2. Generate 100 Reports
        const reports = [];
        for (let i = 0; i < 100; i++) {
            const numVulns = Math.floor(Math.random() * 6); // 0 to 5 vulns
            const currentVulns = [];

            for (let j = 0; j < numVulns; j++) {
                currentVulns.push({
                    title: getRandom(VULN_NAMES),
                    severity: getRandom(SEVERITIES),
                    cvssScore: (Math.random() * 10).toFixed(1),
                    status: getRandom(STATUSES),
                    description: 'Mock description...',
                    recommendation: 'Mock recommendation...',
                    owasp: 'A01:2021-Broken Access Control'
                });
            }

            reports.push({
                user: user._id, // Assign User
                project: project._id,
                systemName: `${getRandom(SYSTEM_PREFIXES)} ${getRandom(SYSTEM_SUFFIXES)} ${Math.floor(Math.random() * 1000)}`,
                url: `https://test-env-${i}.local`,
                format: 'Blackbox',
                environment: Math.random() > 0.5 ? 'Production' : 'Staging',
                vulnerabilities: currentVulns,
                createdAt: getRandomDate(),
                startDate: getRandomDate(), // Not strictly logical relative to created, but fine for mock
                endDate: getRandomDate()
            });
        }

        // 3. Insert
        await Report.insertMany(reports);
        console.log(`Successfully inserted ${reports.length} reports.`);

        process.exit(0);

    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
}

seed();
