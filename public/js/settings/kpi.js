document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    setupEventListeners();
});

const form = document.getElementById('kpiSettingsForm');
const targetsBody = document.getElementById('targetsTableBody');
const template = document.getElementById('targetRowTemplate');

async function loadUsers() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/kpi/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await res.json();

        const select = document.getElementById('userSelect');
        select.innerHTML = '<option value="" disabled selected>Select a User</option>';

        users.forEach(user => {
            const opt = document.createElement('option');
            opt.value = user._id;
            opt.textContent = `${user.username} (${user.email})`;
            select.appendChild(opt);
        });

        // If current user is logged in, maybe select them by default?
        // Or wait for manual selection. Let's wait.
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadSettings() {
    const userId = document.getElementById('userSelect').value;
    const year = document.getElementById('yearInput').value;
    const token = localStorage.getItem('token');

    if (!userId) return;

    try {
        const res = await fetch(`/api/kpi/settings?userId=${userId}&year=${year}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        targetsBody.innerHTML = ''; // Clear current

        if (data && data.targets) {
            data.targets.forEach(target => {
                addRow(target);
            });
        } else {
            // Add one empty row to start?
            // addRow();
        }

    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function addRow(data = {}) {
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('tr');

    if (data.metric) row.querySelector('.target-metric').value = data.metric;
    if (data.tag) row.querySelector('.target-tag').value = data.tag;
    if (data.targetValue) row.querySelector('.target-value').value = data.targetValue;

    row.querySelector('.delete-row-btn').addEventListener('click', () => {
        row.remove();
    });

    targetsBody.appendChild(row);
}

function setupEventListeners() {
    document.getElementById('addTargetBtn').addEventListener('click', () => {
        addRow();
    });

    document.getElementById('userSelect').addEventListener('change', loadSettings);
    document.getElementById('yearInput').addEventListener('change', loadSettings);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });
}

async function saveSettings() {
    const token = localStorage.getItem('token');
    const userId = document.getElementById('userSelect').value;
    const year = document.getElementById('yearInput').value;

    if (!userId) {
        alert('Please select a user');
        return;
    }

    const rows = targetsBody.querySelectorAll('tr');
    const targets = [];

    rows.forEach(row => {
        const metric = row.querySelector('.target-metric').value;
        const tag = row.querySelector('.target-tag').value.trim();
        const targetValue = row.querySelector('.target-value').value;

        if (targetValue) {
            targets.push({
                metric,
                tag,
                targetValue: parseInt(targetValue)
            });
        }
    });

    try {
        const res = await fetch('/api/kpi/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, year, targets })
        });

        if (res.ok) {
            alert('KPI Settings Saved Successfully!');
        } else {
            alert('Error saving settings');
        }

    } catch (error) {
        console.error('Error saving:', error);
        alert('Error saving settings');
    }
}
