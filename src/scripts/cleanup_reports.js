const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Report = require('../models/Report');

const PROJECT_ID_TO_KEEP = '696f3fec0274f26fc601a245';

async function cleanupReports() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect('mongodb://127.0.0.1:55000/RAG_CYBER');
        console.log('Connected.');

        console.log(`Starting cleanup... keeping reports for project: ${PROJECT_ID_TO_KEEP}`);

        const deleteResult = await Report.deleteMany({
            project: { $ne: PROJECT_ID_TO_KEEP }
        });

        console.log(`Cleanup complete! Deleted ${deleteResult.deletedCount} reports.`);
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupReports();
