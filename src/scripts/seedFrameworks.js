const mongoose = require('mongoose');
const Framework = require('../models/Framework');
const connectDB = require('../config/database');
require('dotenv').config();

const seedFrameworks = async () => {
    await connectDB();

    const data = [
        {
            name: "OWASP Top 10",
            year: "2021",
            type: "Web",
            items: [
                { code: "A01:2021", title: "Broken Access Control", description: "" },
                { code: "A02:2021", title: "Cryptographic Failures", description: "" },
                { code: "A03:2021", title: "Injection", description: "" },
                { code: "A04:2021", title: "Insecure Design", description: "" },
                { code: "A05:2021", title: "Security Misconfiguration", description: "" },
                { code: "A06:2021", title: "Vulnerable and Outdated Components", description: "" },
                { code: "A07:2021", title: "Identification and Authentication Failures", description: "" },
                { code: "A08:2021", title: "Software and Data Integrity Failures", description: "" },
                { code: "A09:2021", title: "Security Logging and Monitoring Failures", description: "" },
                { code: "A10:2021", title: "Server-Side Request Forgery", description: "" }
            ]
        },
        {
            name: "OWASP API Security Top 10",
            year: "2023",
            type: "API",
            items: [
                { code: "API1:2023", title: "Broken Object Level Authorization", description: "" },
                { code: "API2:2023", title: "Broken Authentication", description: "" },
                { code: "API3:2023", title: "Broken Object Property Level Authorization", description: "" },
                { code: "API4:2023", title: "Unrestricted Resource Consumption", description: "" },
                { code: "API5:2023", title: "Broken Function Level Authorization", description: "" },
                { code: "API6:2023", title: "Unrestricted Access to Sensitive Business Flows", description: "" },
                { code: "API7:2023", title: "Server Side Request Forgery", description: "" },
                { code: "API8:2023", title: "Security Misconfiguration", description: "" },
                { code: "API9:2023", title: "Improper Inventory Management", description: "" },
                { code: "API10:2023", title: "Unsafe Consumption of APIs", description: "" }
            ]
        },
        {
            name: "OWASP Top 10 for LLM",
            year: "2025",
            type: "LLM",
            items: [
                { code: "LLM01", title: "Prompt Injection", description: "" },
                { code: "LLM02", title: "Insecure Output Handling", description: "" },
                { code: "LLM03", title: "Training Data Poisoning", description: "" },
                { code: "LLM04", title: "Model Denial of Service", description: "" },
                { code: "LLM05", title: "Supply Chain Vulnerabilities", description: "" },
                { code: "LLM06", title: "Sensitive Information Disclosure", description: "" },
                { code: "LLM07", title: "Insecure Plugin Design", description: "" },
                { code: "LLM08", title: "Excessive Agency", description: "" },
                { code: "LLM09", title: "Overreliance", description: "" },
                { code: "LLM10", title: "Model Theft", description: "" }
            ]
        }
    ];

    try {
        for (const f of data) {
            const exists = await Framework.findOne({ name: f.name, year: f.year });
            if (!exists) {
                await Framework.create(f);
                console.log(`Created ${f.name} (${f.year})`);
            } else {
                console.log(`Skipped ${f.name} (${f.year}) - Already exists`);
            }
        }
        console.log("Framework seeding completed.");
    } catch (error) {
        console.error("Error seeding frameworks:", error);
    } finally {
        mongoose.connection.close();
    }
};

seedFrameworks();
