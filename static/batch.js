// Batch command functionality for multiple agents

// Store the current batch command
let batchCommand = '';

// Store selected agents for batch operations
let selectedAgents = new Set();

// Toggle agent selection for batch operations
function toggleAgentSelection(agentId) {
    if (selectedAgents.has(agentId)) {
        selectedAgents.delete(agentId);
    } else {
        selectedAgents.add(agentId);
    }
    
    // Update UI
    updateBatchUI();
}

// Select all agents
function selectAllAgents() {
    Object.keys(agentInfoMap).forEach(agentId => {
        selectedAgents.add(agentId);
    });
    
    updateBatchUI();
}

// Deselect all agents
function deselectAllAgents() {
    selectedAgents.clear();
    updateBatchUI();
}

// Update the batch operation UI
function updateBatchUI() {
    // Update checkboxes
    Object.keys(agentInfoMap).forEach(agentId => {
        const checkbox = document.getElementById(`batch-cb-${agentId}`);
        if (checkbox) {
            checkbox.checked = selectedAgents.has(agentId);
        }
    });
    
    // Update batch panel
    const batchPanel = document.getElementById('batchPanel');
    if (batchPanel) {
        // Show/hide based on selection
        if (selectedAgents.size > 0) {
            batchPanel.style.display = 'block';
            
            // Update counter
            const counter = document.getElementById('batchAgentCount');
            if (counter) {
                counter.textContent = selectedAgents.size;
            }
            
            // Update button states
            const allAgentsCount = Object.keys(agentInfoMap).length;
            
            const selectAllBtn = document.getElementById('selectAllAgentsBtn');
            if (selectAllBtn) {
                selectAllBtn.disabled = selectedAgents.size === allAgentsCount;
            }
            
            const deselectAllBtn = document.getElementById('deselectAllAgentsBtn');
            if (deselectAllBtn) {
                deselectAllBtn.disabled = selectedAgents.size === 0;
            }
        } else {
            batchPanel.style.display = 'none';
        }
    }
}

// Execute a command on all selected agents
function executeBatchCommand() {
    const commandInput = document.getElementById('batchCommandInput');
    if (!commandInput || !commandInput.value.trim()) {
        showToast('Please enter a command', 'warning');
        return;
    }
    
    const command = commandInput.value.trim();
    
    // Check if we have selected agents
    if (selectedAgents.size === 0) {
        showToast('No agents selected', 'warning');
        return;
    }
    
    // Execute on each selected agent
    selectedAgents.forEach(agentId => {
        // Send the command
        ws.send(JSON.stringify({ agent_id: agentId, command: command }));
        
        // Add to output history
        appendToOutput(agentId, `$ ${command}\n`, true);
    });
    
    // Clear the command input
    commandInput.value = '';
    
    showToast(`Command sent to ${selectedAgents.size} agents`, 'success');
}

// Create batch operation UI
function createBatchPanel() {
    // Create the batch panel if it doesn't exist
    if (document.getElementById('batchPanel')) return;
    
    const batchPanel = document.createElement('div');
    batchPanel.id = 'batchPanel';
    batchPanel.className = 'card mt-3';
    batchPanel.style.display = 'none';
    
    const batchHeader = document.createElement('div');
    batchHeader.className = 'card-header d-flex justify-content-between align-items-center';
    
    const batchTitle = document.createElement('span');
    batchTitle.innerHTML = '<b>Batch Operations</b> - <span id="batchAgentCount">0</span> agents selected';
    
    const batchButtons = document.createElement('div');
    
    const selectAllBtn = document.createElement('button');
    selectAllBtn.id = 'selectAllAgentsBtn';
    selectAllBtn.className = 'btn btn-sm btn-outline-secondary me-2';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.onclick = selectAllAgents;
    
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.id = 'deselectAllAgentsBtn';
    deselectAllBtn.className = 'btn btn-sm btn-outline-secondary';
    deselectAllBtn.textContent = 'Deselect All';
    deselectAllBtn.onclick = deselectAllAgents;
    
    batchButtons.appendChild(selectAllBtn);
    batchButtons.appendChild(deselectAllBtn);
    
    batchHeader.appendChild(batchTitle);
    batchHeader.appendChild(batchButtons);
    
    const batchBody = document.createElement('div');
    batchBody.className = 'card-body';
    
    const batchForm = document.createElement('div');
    batchForm.className = 'd-flex';
    
    const batchInput = document.createElement('input');
    batchInput.id = 'batchCommandInput';
    batchInput.className = 'form-control form-control-sm me-2';
    batchInput.placeholder = 'Enter command to run on all selected agents...';
    batchInput.onkeydown = (e) => { if (e.key === 'Enter') executeBatchCommand(); };
    
    const batchExecuteBtn = document.createElement('button');
    batchExecuteBtn.className = 'btn btn-sm btn-primary';
    batchExecuteBtn.textContent = 'Execute';
    batchExecuteBtn.onclick = executeBatchCommand;
    
    batchForm.appendChild(batchInput);
    batchForm.appendChild(batchExecuteBtn);
    
    batchBody.appendChild(batchForm);
    
    batchPanel.appendChild(batchHeader);
    batchPanel.appendChild(batchBody);
    
    // Insert before the tabs
    const tabsContainer = document.getElementById('agentTabs').parentNode;
    tabsContainer.insertBefore(batchPanel, document.getElementById('agentTabs'));
}

// Export for ES6 module usage
export { createBatchPanel };
