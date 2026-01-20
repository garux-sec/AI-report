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

        // New: Render KPI Goals if available
        if (data.goals && data.goals.length > 0) {
            renderKpiGoals(data.goals);
        } else {
            document.getElementById('kpiGoalsContainer').classList.add('hidden');
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function renderKpiGoals(goals) {
    const container = document.getElementById('kpiGoalsContainer');
    container.classList.remove('hidden');

    // Calculate Summary
    const totalGoals = goals.length;
    const avgPercent = totalGoals > 0 ? Math.round(goals.reduce((acc, g) => acc + g.percent, 0) / totalGoals) : 0;

    // Determine Summary Text & Color based on progress
    let summaryText = 'Keep pushing to reach your targets!';
    let summaryColor = 'text-slate-400';
    if (avgPercent >= 100) { summaryText = 'Excellent! All targets achieved.'; summaryColor = 'text-green-400'; }
    else if (avgPercent >= 75) { summaryText = 'Great progress! You are close to your goals.'; summaryColor = 'text-indigo-400'; }
    else if (avgPercent >= 50) { summaryText = 'Good start. Keep improving metrics.'; summaryColor = 'text-blue-400'; }

    container.innerHTML = `
        <div class="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <i class="fas fa-trophy text-yellow-400"></i> My KPI Goals
                </h2>
                <div class="flex flex-col gap-1 mt-1">
                    <p class="text-slate-400 text-sm">Track your yearly performance targets and vulnerability remediation progress.</p>
                    <p class="text-sm ${summaryColor}">
                        <i class="fas fa-chart-line mr-1"></i>
                        Summary: <span class="text-white font-medium">${totalGoals} Targets</span> | 
                        Overall Completion: <span class="text-white font-medium">${avgPercent}%</span> — ${summaryText}
                    </p>
                </div>
            </div>
            <div class="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400">
                Year: 2026
            </div>
        </div>
    `;

    goals.forEach(goal => {
        const isCompleted = goal.percent >= 100;
        const barColor = isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500';

        let metricName = goal.metric;
        if (metricName === 'ReportsClosed') metricName = 'Reports Closed (Fixed)';
        else if (metricName === 'ReportsCompleted') metricName = 'Reports Submitted';
        else if (metricName === 'VulnerabilitiesFound') metricName = 'Vulns Found';

        const html = `
            <div class="card p-6 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <i class="fas fa-bullseye text-6xl text-white"></i>
                </div>
                
                <h3 class="text-lg font-semibold text-white mb-1 flex items-center">
                    <span class="mr-2">${metricName}</span>
                    <span class="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300 border border-slate-600">${goal.tag}</span>
                </h3>
                
                <div class="flex justify-between items-end mb-2">
                    <span class="text-slate-400 text-sm">Target: ${goal.target}</span>
                    <span class="text-2xl font-bold ${isCompleted ? 'text-green-400' : 'text-white'}">
                        ${goal.current} <span class="text-sm font-normal text-slate-500">/ ${goal.target}</span>
                    </span>
                </div>

                <div class="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                    <div class="${barColor} h-4 rounded-full transition-all duration-1000 ease-out relative" style="width: ${goal.percent}%">
                        <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
                
                <div class="text-right mt-1">
                    <span class="text-xs font-medium ${isCompleted ? 'text-green-400' : 'text-indigo-400'}">${goal.percent}%</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
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
