// Agent installation guide modal
function showInstallationModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('installationModal')) {
        createInstallationModal();
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('installationModal'));
    modal.show();
}

function createInstallationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'installationModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'installationModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    
    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog modal-lg';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h5');
    modalTitle.className = 'modal-title';
    modalTitle.id = 'installationModalLabel';
    modalTitle.textContent = 'Agent Installation Guide';
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    closeButton.setAttribute('aria-label', 'Close');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // Installation instructions
    const instructions = document.createElement('div');
    
    // OS tabs
    const osTabs = document.createElement('ul');
    osTabs.className = 'nav nav-tabs';
    osTabs.id = 'osTabs';
    osTabs.setAttribute('role', 'tablist');
    
    // Linux tab
    const linuxTab = document.createElement('li');
    linuxTab.className = 'nav-item';
    linuxTab.setAttribute('role', 'presentation');
    
    const linuxButton = document.createElement('button');
    linuxButton.className = 'nav-link active';
    linuxButton.id = 'linux-tab';
    linuxButton.setAttribute('data-bs-toggle', 'tab');
    linuxButton.setAttribute('data-bs-target', '#linux');
    linuxButton.setAttribute('type', 'button');
    linuxButton.setAttribute('role', 'tab');
    linuxButton.setAttribute('aria-controls', 'linux');
    linuxButton.setAttribute('aria-selected', 'true');
    linuxButton.textContent = 'Linux/macOS';
    
    linuxTab.appendChild(linuxButton);
    
    // Windows tab
    const windowsTab = document.createElement('li');
    windowsTab.className = 'nav-item';
    windowsTab.setAttribute('role', 'presentation');
    
    const windowsButton = document.createElement('button');
    windowsButton.className = 'nav-link';
    windowsButton.id = 'windows-tab';
    windowsButton.setAttribute('data-bs-toggle', 'tab');
    windowsButton.setAttribute('data-bs-target', '#windows');
    windowsButton.setAttribute('type', 'button');
    windowsButton.setAttribute('role', 'tab');
    windowsButton.setAttribute('aria-controls', 'windows');
    windowsButton.setAttribute('aria-selected', 'false');
    windowsButton.textContent = 'Windows';
    
    windowsTab.appendChild(windowsButton);
    
    osTabs.appendChild(linuxTab);
    osTabs.appendChild(windowsTab);
    
    // Tab content
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = 'osTabContent';
    
    // Linux content
    const linuxContent = document.createElement('div');
    linuxContent.className = 'tab-pane fade show active';
    linuxContent.id = 'linux';
    linuxContent.setAttribute('role', 'tabpanel');
    linuxContent.setAttribute('aria-labelledby', 'linux-tab');
    
    const linuxInstructions = document.createElement('div');
    linuxInstructions.className = 'mt-3';
    linuxInstructions.innerHTML = `
        <h5>Install Dependencies</h5>
        <pre class="bg-light p-3"><code>pip install websockets</code></pre>
        
        <h5>Download the Agent Script</h5>
        <pre class="bg-light p-3"><code>curl -O https://raw.githubusercontent.com/yourusername/agented/main/agent.py</code></pre>
        
        <h5>Run the Agent</h5>
        <pre class="bg-light p-3"><code>python agent.py</code></pre>
        
        <h5>Custom Agent ID</h5>
        <pre class="bg-light p-3"><code>python agent.py my-custom-id</code></pre>
        
        <h5>Run as a Service (using systemd)</h5>
        <pre class="bg-light p-3"><code>[Unit]
Description=Agent Service
After=network.target

[Service]
ExecStart=/usr/bin/python /path/to/agent.py
WorkingDirectory=/path/to
Restart=always
User=youruser

[Install]
WantedBy=multi-user.target</code></pre>
    `;
    
    linuxContent.appendChild(linuxInstructions);
    
    // Windows content
    const windowsContent = document.createElement('div');
    windowsContent.className = 'tab-pane fade';
    windowsContent.id = 'windows';
    windowsContent.setAttribute('role', 'tabpanel');
    windowsContent.setAttribute('aria-labelledby', 'windows-tab');
    
    const windowsInstructions = document.createElement('div');
    windowsInstructions.className = 'mt-3';
    windowsInstructions.innerHTML = `
        <h5>Install Dependencies</h5>
        <pre class="bg-light p-3"><code>pip install websockets</code></pre>
        
        <h5>Download the Agent Script</h5>
        <p>Download the agent.py file from the repository.</p>
        
        <h5>Run the Agent</h5>
        <pre class="bg-light p-3"><code>python agent.py</code></pre>
        
        <h5>Custom Agent ID</h5>
        <pre class="bg-light p-3"><code>python agent.py my-custom-id</code></pre>
        
        <h5>Run as a Windows Service</h5>
        <p>Using NSSM (Non-Sucking Service Manager):</p>
        <pre class="bg-light p-3"><code>nssm install AgentService python C:\\path\\to\\agent.py</code></pre>
    `;
    
    windowsContent.appendChild(windowsInstructions);
    
    tabContent.appendChild(linuxContent);
    tabContent.appendChild(windowsContent);
    
    instructions.appendChild(osTabs);
    instructions.appendChild(tabContent);
    
    modalBody.appendChild(instructions);
    
    // Modal footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const closeModalButton = document.createElement('button');
    closeModalButton.type = 'button';
    closeModalButton.className = 'btn btn-secondary';
    closeModalButton.setAttribute('data-bs-dismiss', 'modal');
    closeModalButton.textContent = 'Close';
    
    modalFooter.appendChild(closeModalButton);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modalDialog.appendChild(modalContent);
    modal.appendChild(modalDialog);
    
    document.body.appendChild(modal);
}
