// Dashboard.js - Fixed version
import { createBatchPanel } from './batch.js';

let ws = new WebSocket(`ws://${location.host}/ws/dashboard`);
window.ws = ws;

let agentInfoMap = {};
let agentOutputHistory = {};
let agentLastSeen = {};
let agentTags = {};
let commandTemplates = JSON.parse(localStorage.getItem('commandTemplates') || '[]');
let currentAgentId = '';
let uploadProgress = {};
let downloadProgress = {};
let selectedAgents = new Set();

// --- NOTIFICATION SYSTEM ---
function showToast(message, type = 'info', timeout = 3500) {
    let toast = document.createElement('div');
    // Use string concatenation for className for CSP safety
    toast.className = 'toast align-items-center text-bg-' + type + ' border-0 show';
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    toast.style.minWidth = '220px';
    // Build DOM tree, no innerHTML or template literals
    const dFlex = document.createElement('div');
    dFlex.className = 'd-flex';
    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = message;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-close btn-close-white me-2 m-auto';
    btn.addEventListener('click', function() { toast.remove(); });
    dFlex.appendChild(body);
    dFlex.appendChild(btn);
    toast.appendChild(dFlex);
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, timeout);
}

// --- TAB SWITCHING ---
function switchAgent(agentId) {
    currentAgentId = agentId;
    renderTabs();
    showAgentDetails(agentId);
}

// --- AGENT DETAILS PANEL ---
async function showAgentDetails(agentId) {
    // Always fetch the latest metadata first
    try {
        const infoResp = await fetch(`/api/agent_info/${agentId}`);
        if (infoResp.ok) {
            const info = await infoResp.json();
            console.log(`Fetched info for ${agentId}:`, info);
            if (info && Object.keys(info).length > 0) {
                agentInfoMap[agentId] = info;
            }
        }
    } catch (e) {
        console.error("Error fetching agent info:", e);
    }
    
    await fetchOutputHistory(agentId);
    await fetchTags(agentId);
    await fetchCmdTemplates(agentId);
    renderTabs();
    updateUptime(agentId);
    updateLastSeen(agentId);
    renderCmdTemplates(agentId);
    
    // Initialize or update charts
    setTimeout(() => {
        let cmdInput = document.getElementById(`command-${agentId}`);
        if (cmdInput) cmdInput.focus();
    }, 100);
}

// --- OUTPUT HISTORY & FILTERING ---
async function fetchOutputHistory(agentId) {
    try {
        const resp = await fetch(`/api/output/${agentId}`);
        if (resp.ok) {
            agentOutputHistory[agentId] = await resp.json();
        } else {
            agentOutputHistory[agentId] = [];
        }
    } catch {
        agentOutputHistory[agentId] = [];
    }
    filterOutput(agentId);
}
async function appendToOutput(agentId, text, isPrompt) {
    if (!agentOutputHistory[agentId]) agentOutputHistory[agentId] = [];
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    const entry = { text, isPrompt, timestamp };
    agentOutputHistory[agentId].push(entry);
    // Persist output history to backend
    try {
        await fetch(`/api/output/${agentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, isPrompt, timestamp })
        });
    } catch (e) {
        // Optionally show a notification if you want
    }
    filterOutput(agentId);
}

function filterOutput(agentId) {
    const filter = (document.getElementById(`filter-${agentId}`) || { value: '' }).value.toLowerCase();
    const output = document.getElementById(`output-${agentId}`);
    if (!output) return;
    const history = agentOutputHistory[agentId] || [];
    output.textContent = '';
    let first = true;
    history.forEach(entry => {
        if (!filter || entry.text.toLowerCase().includes(filter)) {
            if (!first) output.textContent += '\n';
            output.textContent += (entry.isPrompt ? `[${entry.timestamp}] ` : '') + entry.text;
            first = false;
        }
    });
    output.scrollTop = output.scrollHeight;
}

// --- DRAG & DROP FILE UPLOAD ---
function handleDrop(event, agentId) {
    event.preventDefault();
    if (!event.dataTransfer.files.length) return;
    const file = event.dataTransfer.files[0];
    document.getElementById(`uploadFile-${agentId}`).files = event.dataTransfer.files;
    showToast(`Uploading ${file.name}...`, 'info');
    uploadFile(agentId);
}

// --- FILE UPLOAD/PROGRESS ---
function uploadFile(agentId) {
    const fileInput = document.getElementById(`uploadFile-${agentId}`);
    const remotePath = document.getElementById(`uploadPath-${agentId}`).value;
    const progressBar = document.getElementById(`uploadProgress-${agentId}`);
    if (!fileInput.files.length || !remotePath) {
        showToast('Select a file and specify a remote path.', 'warning');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onloadstart = function() {
        progressBar.style.display = 'block';
        progressBar.firstElementChild.style.width = '0%';
    };
    reader.onprogress = function(e) {
        if (e.lengthComputable) {
            let percent = Math.round((e.loaded / e.total) * 100);
            progressBar.firstElementChild.style.width = percent + '%';
        }
    };
    reader.onload = function(e) {
        progressBar.firstElementChild.style.width = '100%';
        setTimeout(() => progressBar.style.display = 'none', 800);
        const filedata = e.target.result.split(',')[1]; // base64
        ws.send(JSON.stringify({
            agent_id: agentId,
            action: 'upload',
            filepath: remotePath,
            filedata: filedata
        }));
        appendToOutput(agentId, `[UPLOAD] Sending file to agent: ${remotePath}\n`, true);
        showToast(`File sent: ${file.name}`, 'success');
    };
    reader.onerror = function() {
        progressBar.style.display = 'none';
        showToast('File upload failed.', 'danger');
    };
    reader.readAsDataURL(file);
}

// --- FILE DOWNLOAD/PROGRESS ---
function downloadFile(agentId) {
    const remotePath = document.getElementById(`downloadPath-${agentId}`).value;
    const progressBar = document.getElementById(`downloadProgress-${agentId}`);
    if (!remotePath) {
        showToast('Specify a remote path to download.', 'warning');
        return;
    }
    progressBar.style.display = 'block';
    progressBar.firstElementChild.style.width = '10%';
    ws.send(JSON.stringify({
        agent_id: agentId,
        action: 'download',
        filepath: remotePath
    }));
    appendToOutput(agentId, `[DOWNLOAD] Requesting file from agent: ${remotePath}\n`, true);
}

// --- CLIPBOARD INTEGRATION ---
function copyOutput(agentId) {
    const output = document.getElementById(`output-${agentId}`);
    if (output) {
        navigator.clipboard.writeText(output.textContent).then(() => {
            showToast('Output copied to clipboard!', 'success');
        });
    }
}

// --- TAGS MANAGEMENT ---
async function fetchTags(agentId) {
    const resp = await fetch(`/api/tags/${agentId}`);
    if (resp.ok) {
        const data = await resp.json();
        agentTags[agentId] = data.tags;
    }
}
async function saveTags(agentId, tagsStr) {
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    agentTags[agentId] = tags;
    await fetch(`/api/tags/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
    });
    showToast('Tags updated.', 'info');
}

// --- COMMAND TEMPLATE MANAGEMENT ---
async function fetchCmdTemplates(agentId) {
    const resp = await fetch(`/api/templates/${agentId}`);
    if (resp.ok) {
        commandTemplates = (commandTemplates.filter(t => t.agentId !== agentId))
            .concat((await resp.json()).map(t => ({ agentId, text: t.text, id: t.id })));
        renderCmdTemplates(agentId);
    }
}
async function saveCmdTemplate(agentId) {
    const input = document.getElementById(`newCmdTemplate-${agentId}`);
    const text = input.value.trim();
    if (!text) return;
    await fetch(`/api/templates/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    input.value = '';
    fetchCmdTemplates(agentId);
    showToast('Command template saved.', 'success');
}
async function deleteCmdTemplate(agentId, idx) {
    const filtered = commandTemplates.filter(t => t.agentId === agentId);
    const tpl = filtered[idx];
    if (tpl) {
        await fetch(`/api/templates/${agentId}/${tpl.id}`, { method: 'DELETE' });
        fetchCmdTemplates(agentId);
        showToast('Command template deleted.', 'info');
    }
}

// --- DELETE AGENT ---
async function deleteAgent(agentId) {
    if (!confirm(`Are you sure you want to delete agent ${agentId}? This will remove all data and cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/agent/${agentId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast(`Agent ${agentId} deleted successfully.`, 'success');
            
            // Remove the agent from the frontend
            delete agentInfoMap[agentId];
            delete agentOutputHistory[agentId];
            delete agentLastSeen[agentId];
            delete agentTags[agentId];
            
            // Clean up command templates
            commandTemplates = commandTemplates.filter(t => t.agentId !== agentId);
            
            // Remove from selected agents for batch operations
            if (selectedAgents.has(agentId)) {
                selectedAgents.delete(agentId);
            }
            
            // Switch to another agent if the current one was deleted
            if (currentAgentId === agentId) {
                const remainingAgents = Object.keys(agentInfoMap);
                if (remainingAgents.length > 0) {
                    currentAgentId = remainingAgents[0];
                } else {
                    currentAgentId = '';
                }
            }
            
            // Re-render the UI
            renderTabs();
            if (currentAgentId) {
                await showAgentDetails(currentAgentId);
            }
        } else {
            const data = await response.json();
            showToast(`Failed to delete agent: ${data.message || 'Unknown error'}`, 'danger');
        }
    } catch (error) {
        console.error('Error deleting agent:', error);
        showToast('Failed to delete agent due to an error', 'danger');
    }
}

// --- HEARTBEAT/UPTIME/LAST SEEN ---
function updateUptime(agentId) {
    const info = agentInfoMap[agentId];
    if (!info || !info.start_time) return;
    const el = document.getElementById(`uptime-${agentId}`);
    if (el) {
        const seconds = Math.floor((Date.now() / 1000) - info.start_time);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        el.textContent = `${h}h ${m}m ${s}s`;
    }
}
function updateLastSeen(agentId) {
    const el = document.getElementById(`lastseen-${agentId}`);
    if (el) {
        const last = agentLastSeen[agentId];
        if (!last) { el.textContent = 'Never'; return; }
        const diff = Math.floor((Date.now() - last) / 1000);
        el.textContent = diff < 10 ? 'Now' : `${diff}s ago`;
    }
}
function updateAgentStatusBadges() {
    const agentIds = Object.keys(agentInfoMap);
    agentIds.forEach(agentId => {
        const badge = document.getElementById(`status-${agentId}`);
        if (badge) {
            const last = agentLastSeen[agentId];
            const online = last && (Date.now() - last < 60000); // 60s threshold
            badge.className = 'badge ' + (online ? 'bg-success' : 'bg-secondary');
            badge.textContent = online ? 'Online' : 'Offline';
        }
        updateLastSeen(agentId);
        updateUptime(agentId);
    });
}
setInterval(updateAgentStatusBadges, 5000);

// --- RENDER TABS AND PANELS ---
function renderTabs() {
    const tabs = document.getElementById('agentTabs');
    const content = document.getElementById('agentTabContent');
    tabs.innerHTML = '';
    content.innerHTML = '';
    const agentIds = Object.keys(agentInfoMap);
    if (agentIds.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'alert alert-info';
        emptyDiv.innerHTML = 'No agents connected. <br><small>Run an agent with <code>python agent.py</code> to connect.</small>';
        const setupBtn = document.createElement('button');
        setupBtn.className = 'btn btn-sm btn-outline-primary mt-2';
        setupBtn.innerHTML = '<i class="bi bi-info-circle"></i> Installation Guide';
        setupBtn.onclick = showInstallationModal;
        emptyDiv.appendChild(setupBtn);
        content.appendChild(emptyDiv);
        return;
    }
    // Set currentAgentId if not set or if agent disconnected
    if (!currentAgentId || !agentIds.includes(currentAgentId)) {
        currentAgentId = agentIds[0];
    }
    agentIds.forEach((agentId, idx) => {
        // Tab
        const li = document.createElement('li');
        li.className = 'nav-item d-flex';
        
        // Add checkbox for batch operations
        const batchCheckbox = document.createElement('div');
        batchCheckbox.className = 'form-check align-self-center me-1';
        
        const checkbox = document.createElement('input');
        checkbox.className = 'form-check-input';
        checkbox.type = 'checkbox';
        checkbox.id = `batch-cb-${agentId}`;
        checkbox.checked = selectedAgents.has(agentId);
        checkbox.onclick = (e) => {
            e.stopPropagation(); // Prevent switching to the tab
            toggleAgentSelection(agentId);
        };
        
        batchCheckbox.appendChild(checkbox);
        li.appendChild(batchCheckbox);
        
        const btn = document.createElement('button');
        btn.className = 'nav-link' + (agentId === currentAgentId ? ' active' : '');
        btn.textContent = agentId;
        btn.onclick = () => switchAgent(agentId);
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger ms-1 align-self-center';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete this agent';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent switching to the tab
            deleteAgent(agentId);
        };
        
        li.appendChild(btn);
        li.appendChild(deleteBtn);
        tabs.appendChild(li);
        // Panel
        const panel = document.createElement('div');
        panel.className = 'tab-pane fade' + (agentId === currentAgentId ? ' show active' : '');
        panel.id = `panel-${agentId}`;
        
        // Get agent info with null-safe checks
        const info = agentInfoMap[agentId] || {};
        console.log(`Rendering tab for ${agentId}, info:`, info);
        
        // Calculate uptime if possible
        let uptimeStr = '';
        if (info.start_time) {
            const seconds = Math.floor((Date.now() / 1000) - info.start_time);
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            uptimeStr = `${h}h ${m}m ${s}s`;
        }
        
        // Ensure values exist with strong null checks
        const hostname = info && typeof info.hostname === 'string' ? info.hostname : '(unknown)';
        const os = info && typeof info.os === 'string' ? info.os : '(unknown)';
        const platform = info && typeof info.platform === 'string' ? info.platform : '(unknown)';
        const isOnline = agentLastSeen[agentId] && (Date.now() - agentLastSeen[agentId] < 60000);
        
        panel.innerHTML = `
            <div class="card mt-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span><b>Agent:</b> ${agentId}</span>
                    <div>
                        <span id="status-${agentId}" class="badge ${isOnline ? 'bg-success' : 'bg-secondary'} me-2">${isOnline ? 'Online' : 'Offline'}</span>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteAgent('${agentId}')">Delete Agent</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div><b>Hostname:</b> <span id="hostname-${agentId}">${hostname}</span></div>
                            <div><b>OS:</b> <span id="os-${agentId}">${os}</span></div>
                            <div><b>PID:</b> <span id="pid-${agentId}">${info.pid !== undefined ? info.pid : 'Unknown'}</span></div>
                            <div><b>Uptime:</b> <span id="uptime-${agentId}">${uptimeStr}</span></div>
                            <div><b>Last seen:</b> <span id="lastseen-${agentId}"></span></div>
                            <div><b>Tags:</b> <input id="tags-${agentId}" value="${(agentTags[agentId]||[]).join(', ')}" style="width:200px;"/> <button class="btn btn-sm btn-outline-primary" onclick="saveTags('${agentId}', document.getElementById('tags-${agentId}').value)">Save</button></div>
                        </div>
                        <div class="col-md-6">
                            <div class="card mb-2">
                                <div class="card-header py-1">
                                    <small class="text-muted">Agent Information</small>
                                </div>
                                <div class="card-body">
                                    <div><b>Platform:</b> ${agentInfoMap[agentId]?.platform || 'Unknown'}</div>
                                    <div><b>Current directory:</b> ${info.cwd || 'Unknown'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr/>
                    <div>
                        <input id="command-${agentId}" class="form-control form-control-sm" placeholder="Enter command..." style="width:70%;display:inline-block;" onkeydown="if(event.key==='Enter'){sendCommand('${agentId}')}"/>
                        <button class="btn btn-sm btn-primary" onclick="sendCommand('${agentId}')">Send</button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="copyOutput('${agentId}')">Copy Output</button>
                        <button class="btn btn-sm btn-outline-dark" onclick="openAdvancedTerminal('${agentId}')">
                            <i class="bi bi-terminal"></i> Terminal
                        </button>
                    </div>
                    <div class="mt-2">
                        <input id="filter-${agentId}" class="form-control form-control-sm" placeholder="Filter output..." style="width:50%;display:inline-block;" oninput="filterOutput('${agentId}')"/>
                    </div>
                    <pre id="output-${agentId}" class="mt-2" style="height:200px;overflow:auto;background:#222;color:#eee;padding:10px;border-radius:4px;"></pre>
                    <hr/>
                    <div class="mb-2">
                        <b>Command Templates:</b>
                        <ul id="cmdTemplates-${agentId}" style="list-style:none;padding-left:0;"></ul>
                        <input id="newCmdTemplate-${agentId}" class="form-control form-control-sm" placeholder="New template..." style="width:60%;display:inline-block;"/>
                        <button class="btn btn-sm btn-outline-success" onclick="saveCmdTemplate('${agentId}')">Save</button>
                    </div>
                    <hr/>
                    <div class="mb-2">
                        <b>File Upload:</b>
                        <input type="file" id="uploadFile-${agentId}" style="display:inline-block;width:auto;"/>
                        <input id="uploadPath-${agentId}" class="form-control form-control-sm" placeholder="Remote path..." style="width:40%;display:inline-block;"/>
                        <button class="btn btn-sm btn-outline-primary" onclick="uploadFile('${agentId}')">Upload</button>
                        <div id="uploadProgress-${agentId}" class="progress mt-1" style="height:6px;display:none;width:40%;"><div class="progress-bar" style="width:0%"></div></div>
                    </div>
                    <div class="mb-2">
                        <b>File Download:</b>
                        <input id="downloadPath-${agentId}" class="form-control form-control-sm" placeholder="Remote path..." style="width:40%;display:inline-block;"/>
                        <button class="btn btn-sm btn-outline-primary" onclick="downloadFile('${agentId}')">Download</button>
                        <div id="downloadProgress-${agentId}" class="progress mt-1" style="height:6px;display:none;width:40%;"><div class="progress-bar" style="width:0%"></div></div>
                    </div>
                </div>
            </div>
        `;
        content.appendChild(panel);
        
        // Always filter and render output for all tabs (not just current one)
        filterOutput(agentId);
        renderCmdTemplates(agentId);
        updateLastSeen(agentId);
    });
    
    // Update batch UI
    updateBatchUI();
}

// --- RENDER COMMAND TEMPLATES ---
function renderCmdTemplates(agentId) {
    const container = document.getElementById(`cmdTemplates-${agentId}`);
    if (!container) return;
    container.innerHTML = '';
    const templates = commandTemplates.filter(t => t.agentId === agentId);
    templates.forEach((tpl, idx) => {
        const li = document.createElement('li');
        li.className = 'd-flex justify-content-between align-items-center mb-1';
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-primary flex-grow-1 text-start me-2';
        btn.style.overflow = 'hidden';
        btn.style.textOverflow = 'ellipsis';
        btn.onclick = () => {
            const input = document.getElementById(`command-${agentId}`);
            if (input) input.value = tpl.text;
        };
        btn.textContent = tpl.text;
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-sm btn-outline-danger';
        delBtn.innerHTML = '&times;';
        delBtn.onclick = () => deleteCmdTemplate(agentId, idx);
        li.appendChild(btn);
        li.appendChild(delBtn);
        container.appendChild(li);
    });
}

// --- SEND COMMAND ---
function sendCommand(agentId) {
    const input = document.getElementById(`command-${agentId}`);
    if (!input || !input.value.trim()) return;
    ws.send(JSON.stringify({ agent_id: agentId, command: input.value.trim() }));
    appendToOutput(agentId, `$ ${input.value.trim()}
`, true);
    input.value = '';
}

// --- HANDLE WEBSOCKET MESSAGES ---
ws.onopen = function() {
    showToast('Connected to dashboard server.', 'success');
};
ws.onclose = function() {
    showToast('Disconnected from dashboard server.', 'danger');
};
ws.onerror = function() {
    showToast('WebSocket error.', 'danger');
};
ws.onmessage = async function(event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === 'agent_list') {
        // Remove agents not present
        for (const id of Object.keys(agentInfoMap)) {
            if (!msg.agents.includes(id)) {
                delete agentInfoMap[id];
                delete agentOutputHistory[id];
                delete agentLastSeen[id];
            }
        }
        // Add new agents
        msg.agents.forEach(id => {
            if (!agentInfoMap[id]) agentInfoMap[id] = {};
        });
        renderTabs();
        // If we have agents but no info, trigger showAgentDetails to fetch and render
        msg.agents.forEach(async id => {
            // Always fetch agent info from backend for every agent after agent_list
            try {
                const resp = await fetch(`/api/agent_info/${id}`);
                if (resp.ok) {
                    const info = await resp.json();
                    if (info && Object.keys(info).length > 0) {
                        agentInfoMap[id] = info;
                        // Only renderTabs and showAgentDetails for the current tab to avoid race/overwrites
                        if (id === currentAgentId) {
                            renderTabs();
                            await showAgentDetails(id);
                        }
                    }
                }
            } catch (e) {
                // Optionally show a notification if you want
            }
        });
        // Always render tabs so the user sees the agent list immediately
        renderTabs();
    } else if (msg.action === 'agent_info') {
        const id = msg.agent_id;
        agentInfoMap[id] = msg;
        agentLastSeen[id] = Date.now();
        renderTabs();
        await showAgentDetails(id);
    } else if (msg.agent_id && msg.output) {
        await appendToOutput(msg.agent_id, msg.output, false);
        agentLastSeen[msg.agent_id] = Date.now();
        
        // Also append to terminal if it's open
        const terminalOutput = document.getElementById(`terminal-output-${msg.agent_id}`);
        if (terminalOutput) {
            terminalOutput.textContent += msg.output;
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
        
        renderTabs();
    } else if (msg.action === 'download' && msg.filedata && msg.filename) {
        const a = document.createElement('a');
        a.href = 'data:application/octet-stream;base64,' + msg.filedata;
        a.download = msg.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('File downloaded: ' + msg.filename, 'success');
    } else if (msg.output) {
        showToast(msg.output, 'info');
    }
};

// Expose functions to global scope for HTML event handlers
window.sendCommand = sendCommand;
window.saveTags = saveTags;
window.uploadFile = uploadFile;
window.downloadFile = downloadFile;
window.copyOutput = copyOutput;
window.saveCmdTemplate = saveCmdTemplate;
window.deleteCmdTemplate = deleteCmdTemplate;
window.deleteAgent = deleteAgent;
window.openAdvancedTerminal = openAdvancedTerminal;

// --- INIT ---
window.onload = async function() {
    agentInfoMap = {};
    agentOutputHistory = {};
    agentLastSeen = {};
    currentAgentId = '';
    
    console.log("Dashboard initializing...");
    
    // Initialize dark mode from saved preference
    initDarkMode();
    
    // Create batch panel
    createBatchPanel();
    
    // Fetch all known agents from database (even if not currently connected)
    try {
        console.log("Fetching agent list from backend...");
        const resp = await fetch('/api/agents');
        if (resp.ok) {
            const data = await resp.json();
            console.log(`Received ${data.agents.length} agents from backend:`, data.agents);
            
            if (data.agents && data.agents.length > 0) {
                // Initialize agent maps with empty objects
                data.agents.forEach(id => {
                    agentInfoMap[id] = {};
                    agentOutputHistory[id] = [];
                    agentTags[id] = [];
                });
                
                // Set current agent ID to first one if not already set
                if (!currentAgentId || !data.agents.includes(currentAgentId)) {
                    currentAgentId = data.agents[0];
                }
                
                // Load data for all agents sequentially to avoid race conditions
                for (const id of data.agents) {
                    try {
                        console.log(`Loading data for agent ${id}...`);
                        
                        // Fetch agent metadata first
                        const infoResp = await fetch(`/api/agent_info/${id}`);
                        if (infoResp.ok) {
                            const info = await infoResp.json();
                            console.log(`Got info for ${id}:`, info);
                            if (info && Object.keys(info).length > 0) {
                                agentInfoMap[id] = info;
                                console.log(`Loaded metadata for ${id}:`, info);
                            } else {
                                console.warn(`Empty metadata received for ${id}`);
                            }
                        } else {
                            console.error(`Failed to fetch metadata for ${id}:`, infoResp.status);
                        }
                        
                        // Fetch output history 
                        const outputResp = await fetch(`/api/output/${id}`);
                        if (outputResp.ok) {
                            agentOutputHistory[id] = await outputResp.json();
                            console.log(`Loaded ${agentOutputHistory[id].length} output entries for ${id}`);
                        }
                        
                        // Fetch tags
                        const tagsResp = await fetch(`/api/tags/${id}`);
                        if (tagsResp.ok) {
                            const tagsData = await tagsResp.json();
                            agentTags[id] = tagsData.tags || [];
                        }
                        
                        // Fetch command templates
                        await fetchCmdTemplates(id);
                        
                        // Set last seen to null for all agents initially
                        agentLastSeen[id] = null;
                        
                        // Re-render after each agent is loaded
                        renderTabs();
                        
                    } catch (e) {
                        console.error(`Error loading data for agent ${id}:`, e);
                    }
                }
                
                // Final UI update
                renderTabs();
                if (currentAgentId) {
                    await showAgentDetails(currentAgentId);
                }
                
                console.log("Dashboard initialization complete");
                
            } else {
                console.log("No agents found");
                renderTabs(); // Show 'No agents connected.'
            }
        } else {
            console.error("Failed to fetch agent list:", resp.status);
            renderTabs();
        }
    } catch (e) {
        console.error("Error initializing dashboard:", e);
        renderTabs();
    }
};
