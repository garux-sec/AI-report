document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/';

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    loadFrameworks();

    document.getElementById('frameworkForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('frameworkId').value;
        const name = document.getElementById('name').value;
        const year = document.getElementById('year').value;
        const type = document.getElementById('type').value;
        let items = [];
        try {
            items = JSON.parse(document.getElementById('itemsJson').value || '[]');
        } catch (err) {
            alert('Invalid JSON');
            return;
        }

        const payload = { name, year, type, items };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/frameworks/${id}` : '/api/frameworks';

        await apiRequest(url, method, payload, () => {
            closeModal();
            loadFrameworks();
        });
    });

    // Toggle logic for sidebar
    window.toggleSubmenu = (id) => {
        const el = document.getElementById(id);
        el.classList.toggle('collapsed');
    };
});

async function loadFrameworks() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/frameworks', { headers: { 'Authorization': `Bearer ${token}` } });
        const frameworks = await res.json();
        const tbody = document.querySelector('#frameworkTable tbody');
        tbody.innerHTML = '';
        frameworks.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${f.name}</td>
                <td>${f.year}</td>
                <td>${f.type}</td>
                <td>
                    <button class="btn-sm" onclick='editFramework(${JSON.stringify(f).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn-sm btn-danger" onclick="deleteFramework('${f._id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

window.editFramework = (f) => {
    document.getElementById('frameworkId').value = f._id;
    document.getElementById('name').value = f.name;
    document.getElementById('year').value = f.year;
    document.getElementById('type').value = f.type;
    document.getElementById('itemsJson').value = JSON.stringify(f.items, null, 2);
    document.getElementById('modalTitle').textContent = 'Edit Framework';
    openModal();
};

window.deleteFramework = async (id) => {
    if (!confirm('Delete?')) return;
    await apiRequest(`/api/frameworks/${id}`, 'DELETE', {}, loadFrameworks);
};

window.openModal = () => document.getElementById('frameworkModal').style.display = 'block';
window.closeModal = () => {
    document.getElementById('frameworkModal').style.display = 'none';
    document.getElementById('frameworkForm').reset();
    document.getElementById('frameworkId').value = '';
    document.getElementById('modalTitle').textContent = 'Add Framework';
};

async function apiRequest(url, method, payload, cb) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) cb();
        else {
            const data = await res.json();
            alert(data.message || 'Error');
        }
    } catch (e) { alert('Server Error'); }
}
