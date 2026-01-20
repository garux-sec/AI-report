document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/';

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    loadProjects();

    document.getElementById('projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('projectId').value;

        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('clientName', document.getElementById('clientName').value);
        formData.append('preparedBy', document.getElementById('preparedBy').value);
        formData.append('pentesterName', document.getElementById('pentesterName').value);
        formData.append('pentesterPosition', document.getElementById('pentesterPosition').value);
        formData.append('pentesterEmail', document.getElementById('pentesterEmail').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('status', document.getElementById('status').value);

        const logoFile = document.getElementById('logo').files[0];
        if (logoFile) formData.append('logo', logoFile);

        const bgFile = document.getElementById('background').files[0];
        if (bgFile) formData.append('background', bgFile);

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/projects/${id}` : '/api/projects';

        await apiRequest(url, method, formData, () => {
            closeModal();
            loadProjects();
        });
    });

    window.toggleSubmenu = (id) => {
        document.getElementById(id).classList.toggle('collapsed');
    };
});

async function loadProjects() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/projects', { headers: { 'Authorization': `Bearer ${token}` } });
        const projects = await res.json();
        const tbody = document.querySelector('#projectTable tbody');
        tbody.innerHTML = '';
        projects.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="vertical-align: middle;">
                    <div style="display:flex; align-items:center;">
                        <div style="width:48px; height:48px; border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; margin-right:1rem; border:1px solid var(--glass-border); flex-shrink:0;">
                            ${p.logoUrl
                    ? `<img src="${p.logoUrl}" style="width:100%; height:100%; object-fit:cover;">`
                    : '<span style="font-size:1.5rem; opacity:0.3;">📁</span>'}
                        </div>
                        <div>
                            <a href="/project-dashboard.html?id=${p._id}" style="color:white; text-decoration:none;">
                                <div style="font-weight:600; font-size:1rem;">${p.name}</div>
                            </a>
                            <div style="font-size:0.8rem; opacity:0.7; margin-top:2px;">${p.clientName || 'No Client'}</div>
                        </div>
                    </div>
                </td>
                <td style="vertical-align: middle;">
                    <div style="font-size:0.9rem; margin-bottom:4px;">${p.preparedBy || '-'}</div>
                    <div style="font-size:0.8rem; opacity:0.6;">${p.description ? (p.description.substring(0, 50) + (p.description.length > 50 ? '...' : '')) : '-'}</div>
                </td>
                <td style="vertical-align: middle;">
                    <span style="display:inline-block; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.75rem; font-weight:600; background:${getStatusBg(p.status)}; color:${getStatusColor(p.status)}; border:1px solid ${getStatusColor(p.status)}40;">
                        ${p.status.toUpperCase()}
                    </span>
                </td>
                <td style="vertical-align: middle;">
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button class="btn-sm" style="background:#3b82f6; color:white; border:none;" onclick="cloneProject('${p._id}')" title="Clone Project">
                           Clone
                        </button>
                        <button class="btn-sm" onclick='editProject(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
                        <button class="btn-sm btn-danger" onclick="deleteProject('${p._id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function getStatusColor(status) {
    switch (status) {
        case 'active': return '#10b981';
        case 'completed': return '#8b5cf6';
        case 'archived': return '#64748b';
        default: return '#94a3b8';
    }
}

function getStatusBg(status) {
    switch (status) {
        case 'active': return 'rgba(16, 185, 129, 0.1)';
        case 'completed': return 'rgba(139, 92, 246, 0.1)';
        case 'archived': return 'rgba(100, 116, 139, 0.1)';
        default: return 'rgba(148, 163, 184, 0.1)';
    }
}

window.cloneProject = async (id) => {
    if (!confirm('Clone this project?')) return;
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    await apiRequest(`/api/projects/${id}/clone`, 'POST', {}, () => {
        loadProjects();
    });
};

window.editProject = (p) => {
    document.getElementById('projectId').value = p._id;
    document.getElementById('name').value = p.name;
    document.getElementById('clientName').value = p.clientName || '';
    document.getElementById('preparedBy').value = p.preparedBy || '';
    document.getElementById('pentesterName').value = p.pentesterName || '';
    document.getElementById('pentesterPosition').value = p.pentesterPosition || '';
    document.getElementById('pentesterEmail').value = p.pentesterEmail || '';
    document.getElementById('description').value = p.description || '';
    document.getElementById('status').value = p.status;

    // Clear file inputs visually (cannot set value programmatically)
    document.getElementById('logo').value = '';
    document.getElementById('background').value = '';

    document.getElementById('modalTitle').textContent = 'Edit Project';
    openModal();
};

window.deleteProject = async (id) => {
    if (!confirm('Delete this project?')) return;
    await apiRequest(`/api/projects/${id}`, 'DELETE', {}, loadProjects);
};

window.openModal = () => document.getElementById('projectModal').style.display = 'block';
window.closeModal = () => {
    document.getElementById('projectModal').style.display = 'none';
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('modalTitle').textContent = 'New Project';
};

async function apiRequest(url, method, body, cb) {
    const token = localStorage.getItem('token');

    const options = {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
    };

    // If body is NOT FormData, set Content-Type to JSON (handled automatically for FormData)
    if (!(body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    } else {
        options.body = body;
    }

    try {
        const res = await fetch(url, options);
        if (res.ok) cb();
        else {
            const data = await res.json();
            alert(data.message || 'Error');
        }
    } catch (e) { alert('Server Error'); }
}
