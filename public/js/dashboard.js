document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = '/';
        return;
    }

    const user = JSON.parse(userStr);
    document.getElementById('usernameDisplay').textContent = user.username;

    fetchDashboardStats();
});

async function fetchDashboardStats() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/dashboard-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch stats');

        const data = await res.json();
        updateStatsUI(data);
        renderCharts(data.vulnerabilities, data.reportStats);
        renderRisksTable(data.recentRisks);

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function updateStatsUI(data) {
    document.getElementById('statProjects').textContent = data.counts.projects;
    document.getElementById('statReports').textContent = data.counts.reports;
    document.getElementById('statVulns').textContent = data.counts.vulnerabilities;
}

function renderRisksTable(risks) {
    const tbody = document.getElementById('riskTableBody');
    if (!risks || risks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">No critical or high risks found. Great job!</td></tr>';
        return;
    }

    tbody.innerHTML = risks.map(r => {
        const severityColor = r.severity.toLowerCase() === 'critical' ? 'text-red-400' : 'text-orange-400';
        const statusClass = r.status === 'Open' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400';

        return `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="p-4 font-medium text-white">${r.title || 'Untitled Issue'}</td>
                <td class="p-4">${r.systemName}</td>
                <td class="p-4 font-bold ${severityColor}">${r.severity}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${statusClass}">${r.status}</span>
                </td>
                <td class="p-4 text-slate-400">${new Date(r.date).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');
}

function renderCharts(vulnData, reportStats) {
    // 1. Severity Chart (Doughnut)
    const severityCtx = document.getElementById('severityChart').getContext('2d');

    // Ordered keys for better visualization
    const sevKeys = ['Critical', 'High', 'Medium', 'Low'];
    const sevValues = sevKeys.map(k => vulnData.severity[k] || 0);

    new Chart(severityCtx, {
        type: 'doughnut',
        data: {
            labels: sevKeys,
            datasets: [{
                data: sevValues,
                backgroundColor: [
                    '#ef4444', // Critical - Red
                    '#f97316', // High - Orange
                    '#eab308', // Medium - Yellow
                    '#22c55e'  // Low - Green
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#cbd5e1', font: { family: "'Inter', sans-serif" } }
                }
            },
            cutout: '70%'
        }
    });

    // 2. Report Status Chart (Doughnut - Replaces Vulnerability Status Bar)
    const statusCtx = document.getElementById('statusChart').getContext('2d');

    // Use reportStats logic: Open vs Fixed
    // If no stats provided (e.g. error), default to 0
    const openCount = reportStats ? reportStats.Open : 0;
    const fixedCount = reportStats ? reportStats.Fixed : 0;

    new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'Fixed'],
            datasets: [{
                data: [openCount, fixedCount],
                backgroundColor: [
                    '#ef4444', // Open - Red
                    '#22c55e'  // Fixed - Green
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#cbd5e1', font: { family: "'Inter', sans-serif" } }
                }
            },
            cutout: '70%'
        }
    });
}
