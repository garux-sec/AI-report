document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/';

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    loadUsers();

    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('userId').value;
        const username = document.getElementById('username').value;
        const role = document.getElementById('role').value;
        const password = document.getElementById('password').value;

        const payload = { username, role };
        if (password) payload.password = password;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/users/${id}` : '/api/users';

        await apiRequest(url, method, payload, () => {
            closeModal();
            loadUsers();
        });
    });

    window.toggleSubmenu = (id) => {
        const el = document.getElementById(id);
        el.classList.toggle('collapsed');
    };
});

async function loadUsers() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
        const users = await res.json();
        const tbody = document.querySelector('#userTable tbody');
        tbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>
                    <button class="btn-sm" onclick='editUser(${JSON.stringify(u).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn-sm btn-danger" onclick="deleteUser('${u._id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

window.editUser = (u) => {
    document.getElementById('userId').value = u._id;
    document.getElementById('username').value = u.username;
    document.getElementById('role').value = u.role;
    document.getElementById('password').value = '';
    document.getElementById('modalTitle').textContent = 'Edit User';
    openModal();
};

window.deleteUser = async (id) => {
    if (!confirm('Delete?')) return;
    await apiRequest(`/api/users/${id}`, 'DELETE', {}, loadUsers);
};

window.openModal = () => document.getElementById('userModal').style.display = 'block';
window.closeModal = () => {
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('modalTitle').textContent = 'Add User';
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
