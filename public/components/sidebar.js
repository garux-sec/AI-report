class AppSidebar extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.style.display = 'contents';
        this.innerHTML = `
            <div class="sidebar">
                <h2 style="margin-bottom: 2rem;">Pentest AI</h2>
                <nav>
                    <a href="/dashboard.html" class="nav-link">Dashboard</a>
                    <a href="/projects.html" class="nav-link">Projects</a>

                    <!-- Clicking New Report usually opens a modal, but here we might need to handle it differently or just keep it as is. 
                         In existing code, New Report link was href="#" and sometimes triggered a modal defined in the page.
                         To keep it simple, we might need a global event or just let it specific pages handle it. 
                         However, looking at project-dashboard.html, "New Report" button calls createNewReport(). 
                         The sidebar link # might be a placeholder. Let's keep it consistent with what it was. -->


                    <div class="nav-group">
                        <div class="nav-link-header" id="settings-header">
                            <span>Settings</span>
                            <span class="arrow">▼</span>
                        </div>
                        <div class="submenu" id="settings-submenu">
                            <a href="/settings/frameworks.html" class="nav-sub-link">Frameworks</a>
                            <a href="/settings/users.html" class="nav-sub-link">Users</a>
                            <a href="/settings/ai-connections.html" class="nav-sub-link">AI Connections</a>
                            <a href="/settings/kpi.html" class="nav-sub-link">KPI Settings</a>
                        </div>
                    </div>
                </nav>
                <button class="logout-btn" id="logoutBtn" style="margin-top:auto;">Logout</button>
            </div>
        `;

        this.highlightActiveLink();
        this.setupEventListeners();
    }

    highlightActiveLink() {
        const currentPath = window.location.pathname;

        // Handle main links
        const links = this.querySelectorAll('.nav-link, .nav-sub-link');
        let activeFound = false;

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPath) {
                link.classList.add('active');
                activeFound = true;

                // If it's a sub-link, expand the settings menu
                if (link.classList.contains('nav-sub-link')) {
                    const submenu = this.querySelector('#settings-submenu');
                    const header = this.querySelector('#settings-header');
                    if (submenu && header) {
                        submenu.classList.remove('collapsed');
                        header.classList.remove('collapsed');
                    }
                }
            } else {
                link.classList.remove('active');
            }
        });

        // Specific logic: If we are in project-dashboard or report-edit, we probably want "Projects" to be active?
        // Or maybe report-edit has its own active state.
        // In the original files:
        // project-dashboard.html -> Projects active
        // report-edit.html -> Report Editor active (which is not in the main list above, it was "New Report" or "My Reports"?)
        // Wait, report-edit.html had: <a href="#" class="nav-link active">Report Editor</a> replacing "New Report" or added?
        // Let's check report-edit.html content again.
        // It had: Dashboard, Projects, Report Editor (Active), My Reports.

        // To handle page-specific sidebar variations (like "Report Editor" appearing only on edit page), 
        // we might stick to the standard menu for now. 
        // Or if "Report Editor" is just a context for "Projects", we can highlight Projects.

        if (!activeFound) {
            if (currentPath.includes('/report-edit.html') || currentPath.includes('/project-dashboard.html')) {
                const projectsLink = this.querySelector('a[href="/projects.html"]');
                if (projectsLink) projectsLink.classList.add('active');
            }
        }

        // Default settings menu state logic
        // If not in settings, collapse it
        if (!currentPath.includes('/settings/')) {
            const submenu = this.querySelector('#settings-submenu');
            const header = this.querySelector('#settings-header');
            if (submenu && header) {
                submenu.classList.add('collapsed');
                header.classList.add('collapsed');
            }
        }
    }

    setupEventListeners() {
        // Settings Toggle
        const header = this.querySelector('#settings-header');
        const submenu = this.querySelector('#settings-submenu');

        if (header && submenu) {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
                submenu.classList.toggle('collapsed');
            });
        }

        // Logout
        const logoutBtn = this.querySelector('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            });
        }


    }
}

customElements.define('app-sidebar', AppSidebar);
