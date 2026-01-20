document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/';

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    loadConfigs();

    document.getElementById('aiForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('configId').value;
        const payload = {
            name: document.getElementById('name').value,
            provider: document.getElementById('provider').value,
            apiKey: document.getElementById('apiKey').value,
            baseUrl: document.getElementById('baseUrl').value,
            modelName: document.getElementById('modelNameInput').value,
            isEnabled: document.getElementById('isEnabled').checked
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/ai-config/${id}` : '/api/ai-config';

        await apiRequest(url, method, payload, () => {
            closeModal();
            loadConfigs();
        });
    });

    window.toggleSubmenu = (id) => {
        const el = document.getElementById(id);
        el.classList.toggle('collapsed');
    };
});

async function loadConfigs() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/ai-config', { headers: { 'Authorization': `Bearer ${token}` } });
        const configs = await res.json();
        const tbody = document.querySelector('#aiTable tbody');
        tbody.innerHTML = '';
        configs.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.name} ${c.isDefault ? '<span style="font-size:0.8em; color:var(--primary-color);">(Default)</span>' : ''}</td>
                <td>${c.provider}</td>
                <td>${c.modelName || '-'}</td>
                <td style="color:${c.isEnabled ? 'var(--success-color)' : 'var(--text-color)'}">${c.isEnabled ? 'Active' : 'Disabled'}</td>
                <td>
                    <button class="btn-sm" onclick='editConfig(${JSON.stringify(c).replace(/'/g, "&#39;")})'>Edit</button>
                    ${!c.isDefault ? `<button class="btn-sm" onclick="setDefault('${c._id}')">Set Default</button>` : ''}
                    <button class="btn-sm btn-danger" onclick="deleteConfig('${c._id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

window.toggleProviderFields = () => {
    const provider = document.getElementById('provider').value;
    const baseUrl = document.getElementById('baseUrl');

    // Default URL map
    const defaults = {
        'openai': 'https://api.openai.com/v1',
        'ollama': 'http://localhost:11434',
        'anthropic': 'https://api.anthropic.com',
        'gemini': 'https://generativelanguage.googleapis.com'
    };

    // If the current Base URL is empty OR it matches one of the KNOWN defaults, 
    // update it to the new provider's default.
    const currentVal = baseUrl.value.trim();
    const isKnownDefault = Object.values(defaults).some(v => v === currentVal || currentVal === '');

    if (isKnownDefault && defaults[provider]) {
        baseUrl.value = defaults[provider];
    }
};

window.fetchModels = async () => {
    const provider = document.getElementById('provider').value;
    const apiKey = document.getElementById('apiKey').value;
    const baseUrl = document.getElementById('baseUrl').value;

    if (!provider) return alert('Please select a provider');

    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/ai-config/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ provider, apiKey, baseUrl })
        });

        const data = await res.json();
        if (res.ok) {
            const select = document.getElementById('modelNameSelect');
            const input = document.getElementById('modelNameInput');

            select.innerHTML = '<option value="" disabled selected>Select a Model</option>';
            data.models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                select.appendChild(opt);
            });

            // Switch to Select mode
            input.style.display = 'none';
            select.style.display = 'block';
            select.focus();
        } else {
            alert(data.message || 'Error fetching models');
        }
    } catch (e) {
        console.error(e);
        alert('Failed to connect to provider');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

window.toggleModelInput = () => {
    const input = document.getElementById('modelNameInput');
    const select = document.getElementById('modelNameSelect');

    if (input.style.display === 'none') {
        input.style.display = 'block';
        select.style.display = 'none';
    } else {
        input.style.display = 'none';
        select.style.display = 'block';
    }
};

window.editConfig = (c) => {
    document.getElementById('configId').value = c._id;
    document.getElementById('name').value = c.name;
    document.getElementById('provider').value = c.provider;
    document.getElementById('apiKey').value = c.apiKey || '';
    document.getElementById('baseUrl').value = c.baseUrl || '';
    document.getElementById('modelNameInput').value = c.modelName || '';
    document.getElementById('isEnabled').checked = c.isEnabled;

    // Reset model UI
    document.getElementById('modelNameInput').style.display = 'block';
    document.getElementById('modelNameSelect').style.display = 'none';

    document.getElementById('modalTitle').textContent = 'Edit Connection';
    openModal();
};

window.setDefault = async (id) => {
    await apiRequest(`/api/ai-config/${id}/default`, 'POST', {}, loadConfigs);
};

window.deleteConfig = async (id) => {
    if (!confirm('Delete this connection?')) return;
    await apiRequest(`/api/ai-config/${id}`, 'DELETE', {}, loadConfigs);
};

window.openModal = () => document.getElementById('aiModal').style.display = 'block';
window.closeModal = () => {
    document.getElementById('aiModal').style.display = 'none';
    document.getElementById('aiForm').reset();
    document.getElementById('configId').value = '';

    // Reset model UI
    document.getElementById('modelNameInput').style.display = 'block';
    document.getElementById('modelNameSelect').style.display = 'none';

    document.getElementById('modalTitle').textContent = 'Add Connection';
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
