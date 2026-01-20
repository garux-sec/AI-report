
const urlParams = new URLSearchParams(window.location.search);
const reportId = urlParams.get('id');
const projectId = urlParams.get('projectId');

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/';
    if (!reportId) {
        alert('Report ID not found');
        return;
    }

    loadReportData();
});

async function loadReportData() {
    const token = localStorage.getItem('token');
    try {
        // Fetch Report
        const res = await fetch(`/api/reports/${reportId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load report');
        const report = await res.json();

        // Fetch Project for context
        let project = {};
        if (projectId || report.project) {
            try {
                const pId = projectId || report.project;
                const pRes = await fetch(`/api/projects/${pId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (pRes.ok) project = await pRes.json();
            } catch (e) { console.warn('Project load failed', e); }
        }

        // Fetch Frameworks for lookup
        let frameworkMap = {};
        try {
            const fRes = await fetch(`/api/frameworks`, { // Assuming standard endpoint
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (fRes.ok) {
                const frameworks = await fRes.json();
                frameworks.forEach(f => {
                    // Store FULL object instead of just name
                    frameworkMap[f._id] = f;
                    frameworkMap[f.name] = f;
                    if (f.name) frameworkMap[f.name.trim()] = f;
                });
            }
        } catch (e) { console.warn('Frameworks load failed', e); }

        renderReport(report, project, frameworkMap);
    } catch (e) {
        console.error(e);
        alert('Error loading report data');
    }
}

function renderReport(report, project, frameworkMap = {}) {
    // Cover Page
    document.getElementById('coverSystem').textContent = report.systemName || report.url || 'Target System';

    // Date: 15 January, 2026 format
    const dateOpts = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('coverDate').textContent = new Date(report.createdAt).toLocaleDateString('en-GB', dateOpts);

    // Dynamic Logo
    const logoContainer = document.getElementById('coverLogoContainer');
    if (project.logoUrl || report.logoUrl) {
        logoContainer.innerHTML = `<img src="${project.logoUrl || report.logoUrl}" alt="Logo" class="h-full object-contain">`;
    }

    // Dynamic Background
    if (project.backgroundUrl) {
        document.getElementById('reportBackground').style.backgroundImage = `url('${project.backgroundUrl}')`;
    } else {
        // Fallback or leave empty
        document.getElementById('reportBackground').style.backgroundImage = `url('https://img.freepik.com/free-vector/white-abstract-background-design_23-2148825582.jpg')`;
    }

    // Author
    const author = project.preparedBy || 'Enterprise Security Management';
    document.getElementById('coverAuthor').textContent = author;

    // --- TOC Logic ---
    // TOC Logo
    const tocLogo = document.getElementById('tocHeaderLogo');
    if (tocLogo && (project.logoUrl || report.logoUrl)) {
        tocLogo.innerHTML = `<img src="${project.logoUrl || report.logoUrl}" alt="Logo" class="h-full object-contain">`;
    }

    const tocList = document.getElementById('tocVulnList');
    // Find the main container to replace entire TOC
    const tocContainer = tocList.closest('.space-y-4');

    // Page Calculations
    const execPage = 2;
    const techPage = 3;
    const findingsStartPage = 4;
    const vulnCount = report.vulnerabilities.length;
    const summaryPage = findingsStartPage + vulnCount;
    // Check if Glossary will be rendered (logic copied from bottom)
    const hasGlossary = (report.frameworks && report.frameworks.length > 0);
    const glossaryPage = hasGlossary ? summaryPage + 1 : '-'; // Only show if exists
    // Severity is always after Glossary (or Summary if no Glossary)
    // Based on previous code: severityPageNum = (4 + vulnCount) + (hasGlossary ? 2 : 1)
    // Wait, if Glossary is Summary+1, then Severity is Summary+2. 
    // Let's match the logic exactly.
    // summaryPage = 4 + len.
    // If glossary: glossPage = summaryPage + 1. Severity = summaryPage + 2.
    // If no glossary: Severity = summaryPage + 1.
    const severityPage = hasGlossary ? summaryPage + 2 : summaryPage + 1;

    // Generate Findings List HTML
    let vulnItems = '';
    report.vulnerabilities.forEach((v, i) => {
        const pNum = findingsStartPage + i;
        vulnItems += `
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>3.${i + 1} ${v.title}</div>
                <div>${pNum}</div>
            </div>
        `;
    });

    tocContainer.innerHTML = `
        <!-- 1. Exec Summary -->
        <div class="grid grid-cols-[1fr_auto] gap-2 font-bold text-slate-800">
            <div>1. Executive Summary</div>
            <div>${execPage}</div>
        </div>
        <div class="pl-6 space-y-2 text-slate-600 text-sm mb-4">
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>1.1 Vulnerability Overview</div>
                <div>${execPage}</div>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>1.2 Detailed Summary</div>
                <div>${execPage}</div>
            </div>
        </div>

        <!-- 2. Technical Report -->
        <div class="grid grid-cols-[1fr_auto] gap-2 font-bold text-slate-800">
            <div>2. Technical Report</div>
            <div>${techPage}</div>
        </div>
        <div class="pl-6 space-y-2 text-slate-600 text-sm mb-4">
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>2.1 Methodologies and Standards</div>
                <div>${techPage}</div>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>2.2 Scope</div>
                <div>${techPage}</div>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>2.3 Information Gathering</div>
                <div>${techPage}</div>
            </div>
        </div>

        <!-- 3. Detailed Findings -->
        <div class="grid grid-cols-[1fr_auto] gap-2 font-bold text-slate-800">
            <div>3. Detailed Findings</div>
            <div>${findingsStartPage}</div>
        </div>
            
            <!-- Dynamic Vulnerabilities -->
            <div class="pl-4 space-y-1 text-slate-500 border-l border-slate-200 ml-1">
                ${vulnItems}
            </div>

            <div class="grid grid-cols-[1fr_auto] gap-2 mt-2">
                <div>4. Summary</div>
                <div>${summaryPage}</div>
            </div>
        </div>

        <!-- 5. Glossary -->
        ${hasGlossary ? `
        <div class="grid grid-cols-[1fr_auto] gap-2 font-bold text-slate-800">
            <div>5. Glossary</div>
            <div>${glossaryPage}</div>
        </div>
        <div class="pl-6 space-y-2 text-slate-600 text-sm mb-4">
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>5.1 Reference Frameworks</div>
                <div>${glossaryPage}</div>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>5.2 Severity Definitions</div>
                <div>${severityPage}</div>
            </div>
        </div>
        ` : `
        <!-- No Glossary -->
        <div class="grid grid-cols-[1fr_auto] gap-2 font-bold text-slate-800">
            <div>5. Severity Definitions</div>
            <div>${severityPage}</div>
        </div>
        `}
    `;

    // --- Executive Summary Logic ---

    // 1. Inject Logo into ALL header-logos
    document.querySelectorAll('.header-logo').forEach(el => {
        if (project.logoUrl || report.logoUrl) {
            el.innerHTML = `<img src="${project.logoUrl || report.logoUrl}" alt="Logo" class="h-full object-contain">`;
        } else {
            el.innerHTML = `<div class="text-xl font-bold text-blue-600">MITR PHOL</div>`;
        }
    });

    // 2. Stats & Table Data
    const stats = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
    const vulnSummary = {}; // Key: "Title|OWASP|Severity" -> Count

    report.vulnerabilities.forEach(v => {
        // Normalize severity case (handle lowercase 'critical' from DB)
        let s = (v.severity || 'Info').toLowerCase();
        s = s.charAt(0).toUpperCase() + s.slice(1); // "Critical"

        if (stats[s] !== undefined) stats[s]++;

        // Group for table
        const key = `${v.title}|${v.owasp || ''}|${s}`;
        vulnSummary[key] = (vulnSummary[key] || 0) + 1;
    });

    // Update Cards
    document.getElementById('countCritical').textContent = stats.Critical;
    document.getElementById('countHigh').textContent = stats.High;
    document.getElementById('countMedium').textContent = stats.Medium;
    document.getElementById('countLow').textContent = stats.Low;

    // Update Table
    const tableBody = document.getElementById('execTableBody');
    tableBody.innerHTML = '';
    let totalTableCount = 0;

    Object.keys(vulnSummary).forEach((key, index) => {
        const [title, owasp, severity] = key.split('|');
        const count = vulnSummary[key];
        totalTableCount += count;

        // Severity Color Map for Table Badge (Soft Style)
        const sevColors = {
            'Critical': 'bg-red-100 text-red-700 border border-red-200',
            'High': 'bg-orange-100 text-orange-700 border border-orange-200',
            'Medium': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
            'Low': 'bg-green-100 text-green-700 border border-green-200',
            'Info': 'bg-blue-50 text-blue-700 border border-blue-100'
        };
        const badgeClass = sevColors[severity] || 'bg-gray-100 text-gray-600';

        const row = `
            <tr class="hover:bg-slate-50 transition-colors group">
                <td class="py-4 px-6 text-center text-slate-400 font-mono text-xs group-hover:text-blue-500 transition-colors">${index + 1}</td>
                <td class="py-4 px-6 font-medium text-slate-500 text-xs uppercase tracking-wide">${owasp}</td>
                <td class="py-4 px-6 font-semibold text-slate-700">${title}</td>
                <td class="py-4 px-6 text-center">
                    <span class="inline-block px-3 py-1 rounded-full text-xs font-bold ${badgeClass} shadow-sm">${severity}</span>
                </td>
                <td class="py-4 px-6 text-center font-bold text-slate-800 text-lg">${count}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
    document.getElementById('execTableTotal').textContent = totalTableCount;

    // 3. Dynamic Text
    // dateOpts is already defined above
    const startD = report.startDate ? new Date(report.startDate) : new Date(report.createdAt);

    // Use report.endDate if exists, otherwise mock a 5-day duration from start
    let endD;
    if (report.endDate) {
        endD = new Date(report.endDate);
    } else {
        endD = new Date(startD);
        endD.setDate(endD.getDate() + 5);
    }

    // Frameworks listing
    let frameworksText = 'OWASP Top 10 2021'; // Default
    if (report.frameworks && report.frameworks.length > 0) {
        // Maps IDs (strings or objects) to names using the lookup map or object property
        const names = report.frameworks.map(f => {
            const id = f._id || f; // Handle populated object or raw ID string
            // Correctly handle the frameworkMap possibly containing objects
            const fObj = frameworkMap[id];
            return (fObj ? fObj.name : null) || f.name || f;
        }).join(', ');

        if (names) frameworksText = names;
    }

    const text = `
        การทดสอบเจาะระบบ <strong>${report.systemName} (${report.url || 'No URL'})</strong> ครั้งนี้ ทดสอบในรูปแบบ 
        <strong>${report.format || 'Blackbox'}</strong> ภายใต้สภาพแวดล้อม 
        <strong>${report.environment || 'Production'}</strong> ทดสอบในช่วงวันที่ 
        <strong>${startD.toLocaleDateString('en-GB', dateOpts)} – ${endD.toLocaleDateString('en-GB', dateOpts)}</strong> 
        โดยอ้างอิงมาตรฐานการทดสอบเจาะระบบตาม NIST SP 800-115 และอ้างอิงรายการช่องโหว่ตาม <strong>${frameworksText}</strong>
    `;
    document.getElementById('execSummaryText').innerHTML = text;


    // --- Page 3: Technical Report Logic ---

    // Intro
    document.getElementById('techSystemName').textContent = report.systemName;
    document.getElementById('techUrl').textContent = report.url || '-';

    // Frameworks List Item
    document.getElementById('techFrameworks').textContent = `2.1.2 ${frameworksText}`;

    // 2.2 Scope Table
    document.getElementById('scopeSystem').textContent = report.systemName;
    document.getElementById('scopeUrl').textContent = report.url || '-';
    document.getElementById('scopeFormat').textContent = report.format || 'Black Box';
    document.getElementById('scopeEnv').textContent = report.environment || 'Production';
    document.getElementById('scopeDate').textContent = `${startD.toLocaleDateString('en-GB', dateOpts)} – ${endD.toLocaleDateString('en-GB', dateOpts)}`;

    // 2.3 Info Gathering Table
    const info = report.info || {};
    document.getElementById('infoIp').textContent = info.ip || '-';
    document.getElementById('infoDomain').textContent = info.domain || '-';
    document.getElementById('infoPort').textContent = info.port || '-';
    document.getElementById('infoOs').textContent = info.os || '-';
    document.getElementById('infoServer').textContent = info.server || '-';

    // --- Page 4+: Detailed Findings Logic ---
    const findingsContainer = document.getElementById('findingsContainer');
    findingsContainer.innerHTML = ''; // Clear previous

    if (report.vulnerabilities && report.vulnerabilities.length > 0) {
        report.vulnerabilities.forEach((v, index) => {
            const pageNum = 4 + index;
            const findingNum = `3.${index + 1}`;

            // Normalize severity for colors
            let s = (v.severity || 'Info').toLowerCase();
            s = s.charAt(0).toUpperCase() + s.slice(1);

            const sevColors = {
                'Critical': 'bg-red-500',
                'High': 'bg-orange-500',
                'Medium': 'bg-yellow-400',
                'Low': 'bg-green-500',
                'Info': 'bg-blue-400'
            };
            const sevBg = sevColors[s] || 'bg-gray-400';
            const sevBorder = sevBg.replace('bg-', 'border-');

            // Image Logic
            let imgHtml = '';
            if (v.file) { // Base64 or URL
                imgHtml = `
                    <div class="mt-6 border border-slate-200 rounded-lg p-2 bg-slate-50 shadow-sm">
                        <img src="${v.file}" alt="Proof of Concept" class="w-full h-auto rounded object-contain max-h-[400px]">
                        <div class="text-center text-xs text-slate-500 mt-2 italic">Figure ${index + 1}: Evidence of ${v.title}</div>
                    </div>
                 `;
            }

            const page = document.createElement('div');
            page.className = 'report-page flex flex-col relative';
            page.innerHTML = `
                <!-- Header -->
                <div class="flex justify-between items-end border-b-2 border-cyan-500 pb-2 mb-6">
                    <div class="flex items-center gap-4">
                        <div class="h-10 header-logo-dynamic">
                             ${(project.logoUrl || report.logoUrl) ? `<img src="${project.logoUrl || report.logoUrl}" class="h-full object-contain">` : `<div class="text-xl font-bold text-blue-600">MITR PHOL</div>`}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm font-medium text-slate-800">Penetration Testing Report</div>
                        <div class="text-xs text-red-500 font-medium tracking-wider">Confidential</div>
                    </div>
                    <div class="text-sm font-medium text-slate-500">${pageNum}</div>
                </div>

                <div class="flex-1 px-8 py-2 overflow-hidden">
                    ${index === 0 ? '<h1 class="text-3xl font-bold text-slate-900 mb-8 border-l-8 border-blue-600 pl-4">3. Detailed Findings</h1>' : ''}
                    
                    <!-- Finding Header -->
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex-1">
                            <div class="text-sm font-mono text-slate-500 mb-1">${findingNum}</div>
                            <h2 class="text-2xl font-bold text-slate-800 leading-tight">${v.title}</h2>
                            <div class="text-xs text-slate-500 mt-1 font-mono">${v.owasp || 'OWASP: N/A'}</div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <div class="flex items-center gap-2">
                                <!-- Status Badge -->
                                <span class="${v.status === 'Fixed' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border">
                                    ${v.status || 'Open'}
                                </span>
                                <!-- Severity Badge -->
                                <span class="${sevBg} text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider">${s}</span>
                            </div>
                            
                            <!-- CVSS Block -->
                            ${v.cvssScore ? `
                                <div class="text-right mt-1 p-1.5 bg-slate-50 rounded border border-slate-100 max-w-[200px]">
                                    <div class="text-xs font-bold text-slate-700">CVSS v${v.cvssVersion || '3.1'}: <span class="text-blue-600">${v.cvssScore}</span></div>
                                    <div class="text-[9px] text-slate-400 font-mono break-all leading-tight">${v.cvssVector || ''}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Details Card -->
                    <div class="bg-white border-l-4 ${sevBorder.replace('bg-', 'border-')} border-y border-r border-slate-200 rounded-r-lg p-5 mb-6 shadow-sm">
                        <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <i class="fas fa-align-left text-slate-400"></i> Description & Impact
                        </h3>
                        <p class="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">${v.detail || v.new_detail || 'No description provided.'}</p>
                    </div>

                    <!-- URL / Affected Card -->
                    <div class="bg-white border-l-4 border-slate-500 border-y border-r border-slate-200 rounded-r-lg p-5 mb-6 shadow-sm">
                        <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <i class="fas fa-link text-slate-400"></i> Affected URL / Component
                        </h3>
                        <div class="font-mono text-sm text-slate-600 break-all">
                            ${v.affected || report.url || 'N/A'}
                        </div>
                    </div>

                    <!-- Remediation -->
                    <div class="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
                        <h3 class="text-sm font-bold text-green-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                             <i class="fas fa-shield-alt"></i> Recommendation
                        </h3>
                        <p class="text-green-900 text-sm leading-relaxed whitespace-pre-wrap">${v.fix || 'No recommendation provided.'}</p>
                    </div>

                    <!-- PoC / Image -->
                    ${imgHtml}
                </div>
            `;
            findingsContainer.appendChild(page);
        });

        // --- Page 2.5: Final Summary ---
        const summaryPage = document.createElement('div');
        summaryPage.className = 'report-page flex flex-col relative';
        const summaryPageNum = 4 + report.vulnerabilities.length;

        let summaryTableRows = '';
        let totalSummaryCount = 0;

        const finalVulnSummary = {};
        report.vulnerabilities.forEach(v => {
            let s = (v.severity || 'Info').toLowerCase();
            s = s.charAt(0).toUpperCase() + s.slice(1);
            const key = `${v.title}|${v.owasp || ''}|${s}`;
            finalVulnSummary[key] = (finalVulnSummary[key] || 0) + 1;
        });

        Object.keys(finalVulnSummary).forEach((key, index) => {
            const [title, owasp, severity] = key.split('|');
            const count = finalVulnSummary[key];
            totalSummaryCount += count;

            const sevColors = {
                'Critical': 'bg-red-100 text-red-700 border border-red-200',
                'High': 'bg-orange-100 text-orange-700 border border-orange-200',
                'Medium': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
                'Low': 'bg-green-100 text-green-700 border border-green-200',
            };
            const badgeClass = sevColors[severity] || 'bg-blue-50 text-blue-700 border border-blue-100';

            summaryTableRows += `
                <tr class="hover:bg-slate-50 transition-colors group">
                    <td class="py-4 px-6 text-center text-slate-400 font-mono text-xs group-hover:text-blue-500 transition-colors">${index + 1}</td>
                    <td class="py-4 px-6 font-medium text-slate-500 text-xs uppercase tracking-wide">${owasp}</td>
                    <td class="py-4 px-6 font-semibold text-slate-700">${title}</td>
                    <td class="py-4 px-6 text-center">
                        <span class="inline-block px-3 py-1 rounded-full text-xs font-bold ${badgeClass} shadow-sm">${severity}</span>
                    </td>
                    <td class="py-4 px-6 text-center font-bold text-slate-800 text-lg">${count}</td>
                </tr>
            `;
        });

        summaryPage.innerHTML = `
            <!-- Header -->
            <div class="flex justify-between items-end border-b-2 border-cyan-500 pb-2 mb-8 relative">
                <div class="flex items-center gap-4">
                    <div class="h-10 header-logo-dynamic">
                         ${(project.logoUrl || report.logoUrl) ? `<img src="${project.logoUrl || report.logoUrl}" class="h-full object-contain">` : `<div class="text-xl font-bold text-blue-600">MITR PHOL</div>`}
                    </div>
                </div>
                <div class="absolute left-1/2 bottom-2 -translate-x-1/2 text-center">
                    <div class="text-sm font-medium text-slate-800">Penetration Testing Report</div>
                    <div class="text-xs text-red-500 font-medium tracking-wider">Confidential</div>
                </div>
                <div class="text-sm font-medium text-slate-500">${summaryPageNum}</div>
            </div>

            <!-- Content -->
            <div class="flex-1 px-8 py-4">
                <h1 class="text-3xl font-bold text-slate-900 mb-8 border-l-8 border-blue-600 pl-4">4. Summary</h1>

                <p class="text-slate-700 leading-relaxed text-lg mb-8">
                    การทดสอบเจาะระบบ <strong>${report.systemName} (${report.environment || 'Production'})</strong> 
                    โดยทดสอบเจาะระบบในรูปแบบ <strong>${report.format || 'Black Box'}</strong> 
                    ภายใต้สภาพแวดล้อม ${report.environment || 'Production'} ช่วงวันที่ 
                    <strong>${startD.toLocaleDateString('en-GB', dateOpts)} – ${endD.toLocaleDateString('en-GB', dateOpts)}</strong> 
                    โดยตรวจพบช่องโหว่ ดังนี้
                </p>

                <!-- Table -->
                <div class="rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-10">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th class="py-4 px-6 font-bold w-16 text-center">#</th>
                                <th class="py-4 px-6 font-bold w-1/3">OWASP Top 10</th>
                                <th class="py-4 px-6 font-bold">Vulnerability Name</th>
                                <th class="py-4 px-6 font-bold w-32 text-center">Severity</th>
                                <th class="py-4 px-6 font-bold w-24 text-center">Count</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                            ${summaryTableRows}
                        </tbody>
                        <tfoot class="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                            <tr>
                                <td colspan="4" class="py-3 px-6 text-right uppercase text-xs tracking-wider text-slate-500">Total Vulnerabilities Found</td>
                                <td class="py-3 px-6 text-center text-lg text-blue-600">${totalSummaryCount}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Recommendation & Disclaimer -->
                <div class="space-y-6 text-slate-700 leading-relaxed indent-8 text-justify">
                    <p>
                        โดยทีม <strong>${author}</strong> ขอแนะนำให้เจ้าของระบบ หรือ ผู้ดูแลระบบ ปิดกั้นช่องโหว่ (Patch) 
                        ตามข้อแนะนำการแก้ไขช่องโหว่ในเอกสารฉบับนี้ในโอกาสแรก
                    </p>
                    <p>
                        ทั้งนี้ การทดสอบเจาะระบบในครั้งนี้ ไม่สามารถนำมายืนยันว่าจะไม่เกิดการโจมตีทางไซเบอร์อีกในอนาคต 
                        เนื่องจากอาจจะมีการค้นพบช่องโหว่ชนิดใหม่ ซึ่งสามารถนำมาโจมตีระบบได้ ดังนั้น ผู้ดูแลระบบจำเป็นต้องทำการตรวจสอบระบบ 
                        ปิดกั้นช่องโหว่ และดำรงความต่อเนื่องของการปรับปรุงระบบให้เป็นปัจจุบันอย่างสม่ำเสมอ
                    </p>
                </div>
            </div>
        `;
        findingsContainer.appendChild(summaryPage);

        // --- Page 3: Glossary ---
        // Only render if we have frameworks to show
        if (report.frameworks && report.frameworks.length > 0) {

            // Fallback hardcoded data if DB returned nothing for specific items
            const fallbackGlossaryData = {
                'OWASP Top 10 2021': [
                    { id: 'A01:2021-Broken Access Control', desc: 'ช่องโหว่ที่เกิดจากการควบคุมการเข้าถึงที่ไม่เหมาะสมทำให้ผู้ใช้สามารถเข้าถึงข้อมูลหรือฟังก์ชันที่ไม่ควรมีสิทธิ์เข้าถึงได้' },
                    { id: 'A02:2021-Cryptographic Failures', desc: 'ช่องโหว่ที่เกิดจากการใช้การเข้ารหัสที่ไม่เหมาะสม รวมถึงการอนุญาตเข้าถึงข้อมูลที่ละเอียดอ่อนของระบบได้ ส่งผลให้ข้อมูลสำคัญถูกเปิดเผยหรือถูกโจมตีได้' },
                    { id: 'A03:2021-Injection', desc: 'ช่องโหว่ที่เกิดจากการแทรกคำสั่งอันตรายเข้าไปในคำสั่งที่ถูกประมวลผลโดยแอปพลิเคชัน เช่น SQL Injection หรือ Command Injection ซึ่งสามารถทำให้ผู้โจมตีเข้าควบคุมระบบหรือขโมยข้อมูลได้' },
                    { id: 'A04:2021-Insecure Design', desc: 'ช่องโหว่ที่เกิดจากการออกแบบที่ไม่ปลอดภัยหรือขาดการพิจารณาด้านความปลอดภัยตั้งแต่ขั้นตอนการออกแบบแอปพลิเคชัน ทำให้เกิดช่องโหว่ที่ยากต่อการแก้ไขภายหลัง' },
                    { id: 'A05:2021-Security Misconfiguration', desc: 'ช่องโหว่ที่เกิดจากการกำหนดค่าความปลอดภัยที่ไม่ถูกต้อง เช่น การตั้งค่าความปลอดภัยที่อ่อนแอหรือไม่ได้ใช้งานคุณสมบัติความปลอดภัยที่มีอยู่ ส่งผลให้ระบบเสี่ยงต่อการถูกโจมตี' },
                    { id: 'A06:2021-Vulnerable and Outdated Components', desc: 'ช่องโหว่ที่เกิดจากการใช้ส่วนประกอบซอฟต์แวร์ที่มีช่องโหว่หรือไม่ได้อัปเดต ทำให้แอปพลิเคชันตกเป็นเป้าหมายของการโจมตีได้ง่าย' },
                    { id: 'A07:2021-Identification and Authentication Failures', desc: 'ช่องโหว่ที่เกิดจากความล้มเหลวในการยืนยันตัวตนและการจัดการสิทธิ์ เช่น การจัดการ session ที่ไม่เหมาะสมหรือใช้รหัสผ่านที่ไม่ปลอดภัย' },
                    { id: 'A08:2021-Software and Data Integrity Failures', desc: 'ช่องโหว่ที่เกิดจากความล้มเหลวในการรักษาความถูกต้องของข้อมูลและซอฟต์แวร์ ทำให้เกิดการเปลี่ยนแปลงข้อมูลหรือโค้ดที่ไม่ตั้งใจหรือไม่คาดคิด' },
                    { id: 'A09:2021-Security Logging and Monitoring Failures', desc: 'ช่องโหว่ที่เกิดจากขาดการบันทึกหรือการติดตามเหตุการณ์ความปลอดภัยที่เพียงพอ ทำให้ไม่สามารถตรวจจับและตอบสนองต่อเหตุการณ์ความปลอดภัยได้ทันท่วงที' },
                    { id: 'A10:2021-Server-Side Request Forgery', desc: 'ช่องโหว่ที่เกิดจากช่องโหว่ที่เกิดขึ้นเมื่อเซิร์ฟเวอร์สามารถถูกหลอกให้ส่งคำขอไปยังที่อยู่ที่ผู้โจมตีต้องการ ทำให้สามารถเข้าถึงหรือแก้ไขข้อมูลภายในได้' }
                ],
                'NIST SP 800-115': [
                    { id: 'NIST SP 800-115', desc: 'Technical Guide to Information Security Testing and Assessment - มาตรฐานคู่มือทางเทคนิคสำหรับการทดสอบและการประเมินความมั่นคงปลอดภัยสารสนเทศ' }
                ]
            };

            const glossaryPage = document.createElement('div');
            glossaryPage.className = 'report-page flex flex-col relative';
            const glossPageNum = summaryPageNum + 1; // Simplify

            let glossaryContent = '';

            report.frameworks.forEach((f, i) => {
                const id = f._id || f;
                let frameworkObj = frameworkMap[id];
                if (!frameworkObj && typeof f === 'object' && f.name) frameworkObj = f;

                const name = frameworkObj ? frameworkObj.name : (f.name || f);
                const cleanName = typeof name === 'string' ? name.trim() : String(name);

                let items = [];

                if (frameworkObj && frameworkObj.items && frameworkObj.items.length > 0) {
                    items = frameworkObj.items.map(item => ({
                        id: item.code ? `${item.code} ${item.title || ''}` : item.title,
                        desc: item.description
                    }));
                } else {
                    let matchedKey = null;
                    if (fallbackGlossaryData[cleanName]) matchedKey = cleanName;
                    else {
                        const customKeys = Object.keys(fallbackGlossaryData);
                        matchedKey = customKeys.find(k => cleanName.includes(k) || k.includes(cleanName));
                    }
                    if (matchedKey && fallbackGlossaryData[matchedKey]) {
                        items = fallbackGlossaryData[matchedKey];
                    }
                }

                if (items.length > 0) {
                    const rows = items.map(item => `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-3 px-4 border border-slate-200 font-medium text-slate-700 align-top w-1/3 text-xs">${item.id}</td>
                            <td class="py-3 px-4 border border-slate-200 text-slate-600 align-top text-justify leading-relaxed text-xs">${item.desc}</td>
                        </tr>
                    `).join('');

                    glossaryContent += `
                        <div class="mb-8">
                            <h2 class="text-xl font-bold text-slate-800 mb-4 pl-3 border-l-4 border-slate-400">5.${i + 1} ${cleanName}</h2>
                            <div class="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                <table class="w-full text-sm text-left border-collapse">
                                    <thead class="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th class="py-3 px-4 border border-slate-200 font-bold w-1/3 text-center">Reference</th>
                                            <th class="py-3 px-4 border border-slate-200 font-bold text-center">Description (คำอธิบาย)</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100 bg-white">
                                        ${rows}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
            });

            if (glossaryContent) {
                glossaryPage.innerHTML = `
                    <!-- Header -->
                    <div class="flex justify-between items-end border-b-2 border-cyan-500 pb-2 mb-8 relative">
                        <div class="flex items-center gap-4">
                            <div class="h-10 header-logo-dynamic">
                                ${(project.logoUrl || report.logoUrl) ? `<img src="${project.logoUrl || report.logoUrl}" class="h-full object-contain">` : `<div class="text-xl font-bold text-blue-600">MITR PHOL</div>`}
                            </div>
                        </div>
                        <div class="absolute left-1/2 bottom-2 -translate-x-1/2 text-center">
                            <div class="text-sm font-medium text-slate-800">Penetration Testing Report</div>
                            <div class="text-xs text-red-500 font-medium tracking-wider">Confidential</div>
                        </div>
                        <div class="text-sm font-medium text-slate-500">${glossPageNum}</div>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 px-8 py-4">
                        <h1 class="text-3xl font-bold text-slate-900 mb-8 border-l-8 border-blue-600 pl-4">5. Glossary</h1>
                        ${glossaryContent}
                    </div>
                `;
                findingsContainer.appendChild(glossaryPage);
            }
        }

        // --- Page 3.2: Severity ---
        const severityPage = document.createElement('div');
        severityPage.className = 'report-page flex flex-col relative';

        // Calculate page number (Summary + Glossary Pages + 1)
        const hasGlossary = (report.frameworks && report.frameworks.length > 0);
        const severityPageNum = (4 + report.vulnerabilities.length) + (hasGlossary ? 2 : 1);

        severityPage.innerHTML = `
             <!-- Header -->
            <div class="flex justify-between items-end border-b-2 border-cyan-500 pb-2 mb-8 relative">
                <div class="flex items-center gap-4">
                    <div class="h-10 header-logo-dynamic">
                         ${(project.logoUrl || report.logoUrl) ? `<img src="${project.logoUrl || report.logoUrl}" class="h-full object-contain">` : `<div class="text-xl font-bold text-blue-600">MITR PHOL</div>`}
                    </div>
                </div>
                <div class="absolute left-1/2 bottom-2 -translate-x-1/2 text-center">
                    <div class="text-sm font-medium text-slate-800">Penetration Testing Report</div>
                    <div class="text-xs text-red-500 font-medium tracking-wider">Confidential</div>
                </div>
                <div class="text-sm font-medium text-slate-500">${severityPageNum}</div>
            </div>

            <!-- Content -->
            <div class="flex-1 px-8 py-4">
                <!-- Severity Definitions -->
                <div class="mb-8 break-inside-avoid">
                    <h2 class="text-xl font-bold text-slate-800 mb-4 pl-3 border-l-4 border-slate-400">5.2 Severity Definitions</h2>
                    <div class="overflow-hidden border border-slate-300 rounded-lg shadow-sm">
                        <table class="w-full border-collapse">
                            <thead>
                                <tr class="text-center text-black font-bold text-sm">
                                    <th class="w-1/4 p-3 border border-slate-300 bg-red-600 text-white">Critical</th>
                                    <th class="w-1/4 p-3 border border-slate-300 bg-orange-400">High</th>
                                    <th class="w-1/4 p-3 border border-slate-300 bg-yellow-300">Medium</th>
                                    <th class="w-1/4 p-3 border border-slate-300 bg-green-400">Low</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- CVSS Row -->
                                <tr class="text-center font-bold text-slate-800 text-sm bg-slate-50">
                                    <td class="p-3 border border-slate-300">CVSS: 9.0 - 10.0</td>
                                    <td class="p-3 border border-slate-300">CVSS: 7.0 - 8.9</td>
                                    <td class="p-3 border border-slate-300">CVSS: 4.0 - 6.9</td>
                                    <td class="p-3 border border-slate-300">CVSS: 0.1 - 3.9</td>
                                </tr>
                                <!-- Description Row -->
                                <tr class="text-sm text-slate-700 leading-relaxed align-top">
                                    <td class="p-4 border border-slate-300">
                                        ช่องโหว่ที่มีความรุนแรงสูงสุด มักจะถูกโจมตีได้ง่ายและส่งผลกระทบอย่างร้ายแรง เช่น ยึดระบบ, ขโมยข้อมูล, หรือทำลายข้อมูล
                                    </td>
                                    <td class="p-4 border border-slate-300">
                                        ช่องโหว่ที่มีความรุนแรงสูง สามารถถูกโจมตีได้ และมีผลกระทบที่สำคัญ แต่ไม่ถึงระดับที่ทำให้ระบบถูกยึดครองได้ทั้งหมด
                                    </td>
                                    <td class="p-4 border border-slate-300">
                                        ช่องโหว่ที่มีความรุนแรงปานกลาง การโจมตีอาจทำได้ยากขึ้นหรือส่งผลกระทบที่ไม่รุนแรงมากนัก
                                    </td>
                                    <td class="p-4 border border-slate-300">
                                        ช่องโหว่ที่มีความเสี่ยงต่ำ การโจมตีเกิดขึ้นได้ยากและผลกระทบมีน้อยมาก
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        findingsContainer.appendChild(severityPage);

        // --- PDF Download Logic ---
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                // Visual feedback
                const originalText = downloadBtn.innerHTML;
                downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Generating PDF...';
                downloadBtn.disabled = true;

                // Prepare options
                // Prepare options
                const element = document.body;
                const opt = {
                    margin: 0,
                    filename: `Report_Pentest_${report.systemName || 'System'}_${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                // Hide buttons temporarily (though .no-print helper classes usually handled by print css, 
                // html2pdf takes screenshot so we must hide manualy)
                document.querySelectorAll('.no-print').forEach(el => el.style.display = 'none');

                // Generate
                html2pdf().set(opt).from(element).save().then(() => {
                    // Restore UI
                    downloadBtn.innerHTML = originalText;
                    downloadBtn.disabled = false;
                    document.querySelectorAll('.no-print').forEach(el => el.style.display = '');
                }).catch(err => {
                    console.error('PDF Generation Error:', err);
                    alert('Error generating PDF. Please try "Print" -> "Save as PDF" instead.');
                    downloadBtn.innerHTML = originalText;
                    downloadBtn.disabled = false;
                    document.querySelectorAll('.no-print').forEach(el => el.style.display = '');
                });
            });
        }

        // --- Back Cover Page ---
        const backCoverPage = document.createElement('div');
        backCoverPage.className = 'report-page flex flex-col items-center justify-center relative overflow-hidden';

        // Background Element (Separate div for opacity like Front Cover)
        const bgDiv = document.createElement('div');
        bgDiv.className = 'absolute inset-0 opacity-10 pointer-events-none';
        bgDiv.style.backgroundSize = 'cover';
        bgDiv.style.backgroundPosition = 'center';

        if (project.backgroundUrl) {
            bgDiv.style.backgroundImage = `url('${project.backgroundUrl}')`;
        } else {
            bgDiv.style.backgroundImage = `url('https://img.freepik.com/free-vector/white-abstract-background-design_23-2148825582.jpg')`;
        }
        backCoverPage.appendChild(bgDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'flex flex-col items-center gap-6 z-10 w-full max-w-2xl px-4';
        contentDiv.innerHTML = `
            <div class="h-24 mb-6">
                 ${(project.logoUrl || report.logoUrl) ? `<img src="${project.logoUrl || report.logoUrl}" class="h-full object-contain">` : `<div class="text-4xl font-bold text-blue-600">MITR PHOL</div>`}
            </div>
            
            <div class="text-slate-600 text-sm">This report was prepared by</div>
            
            <h2 class="text-3xl font-bold text-slate-800 mb-2">${project.preparedBy || 'Enterprise Security Management'}</h2>
            
            <div class="text-slate-600 text-sm mt-4">For more information, contact</div>
            
            <div class="text-center space-y-1">
                <div class="text-slate-800 font-medium">
                    ${project.pentesterName || 'Mr. Phisit Pupiw'} : ${project.pentesterPosition || 'Cybersecurity Validation Analyst'}
                </div>
                <div class="text-slate-600 text-sm">Email: ${project.pentesterEmail || 'phisitpu@mitrphol.com'}</div>
            </div>
        `;
        backCoverPage.appendChild(contentDiv);

        // Confidential Markers (Absolute relative to page)
        const topConf = document.createElement('div');
        topConf.className = 'absolute top-12 text-red-500 text-sm font-medium tracking-wider z-10';
        topConf.textContent = 'Confidential';
        backCoverPage.appendChild(topConf);

        const botConf = document.createElement('div');
        botConf.className = 'absolute bottom-12 text-red-500 text-sm font-medium tracking-wider z-10';
        botConf.textContent = 'Confidential';
        backCoverPage.appendChild(botConf);

        findingsContainer.appendChild(backCoverPage);
    }

}
