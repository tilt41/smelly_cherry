// Advanced terminal emulation for command input/output

// Stores terminal history for each agent
let terminalHistory = {};
let historyPosition = {};
let previousCommands = {};

// Create an advanced terminal UI for an agent
function createAdvancedTerminal(agentId) {
    // Initialize history arrays if needed
    if (!terminalHistory[agentId]) {
        terminalHistory[agentId] = [];
    }
    
    if (!previousCommands[agentId]) {
        previousCommands[agentId] = [];
    }
    
    if (historyPosition[agentId] === undefined) {
        historyPosition[agentId] = -1;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = `terminal-modal-${agentId}`;
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', `terminal-modal-label-${agentId}`);
    modal.setAttribute('aria-hidden', 'true');
    
    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog modal-lg modal-dialog-centered';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h5');
    modalTitle.className = 'modal-title';
    modalTitle.id = `terminal-modal-label-${agentId}`;
    modalTitle.textContent = `Terminal: ${agentId}`;
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    closeButton.setAttribute('aria-label', 'Close');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body p-0';
    
    // Terminal container
    const terminalContainer = document.createElement('div');
    terminalContainer.className = 'terminal-container';
    terminalContainer.style.height = '400px';
    terminalContainer.style.backgroundColor = '#000';
    terminalContainer.style.color = '#00ff00';
    terminalContainer.style.fontFamily = 'monospace';
    terminalContainer.style.padding = '10px';
    terminalContainer.style.overflowY = 'auto';
    terminalContainer.style.position = 'relative';
    
    // Terminal output
    const terminalOutput = document.createElement('pre');
    terminalOutput.className = 'terminal-output';
    terminalOutput.id = `terminal-output-${agentId}`;
    terminalOutput.style.height = 'calc(100% - 40px)';
    terminalOutput.style.margin = '0';
    terminalOutput.style.overflowY = 'auto';
    terminalOutput.style.color = 'inherit';
    
    // Terminal input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'd-flex align-items-center mt-2';
    inputContainer.style.position = 'sticky';
    inputContainer.style.bottom = '0';
    
    // Prompt
    const prompt = document.createElement('span');
    prompt.className = 'prompt me-2';
    prompt.textContent = '$ ';
    prompt.style.color = '#00ff00';
    
    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-input form-control bg-dark text-light border-0';
    input.id = `terminal-input-${agentId}`;
    input.style.flexGrow = '1';
    input.style.fontFamily = 'monospace';
    
    // Handle input
    input.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            const command = input.value.trim();
            if (command) {
                // Add command to history
                previousCommands[agentId].push(command);
                historyPosition[agentId] = -1;
                
                // Send command
                window.ws.send(JSON.stringify({ agent_id: agentId, command: command }));
                
                // Add to terminal output
                appendToTerminal(agentId, `$ ${command}\n`);
                
                // Clear input
                input.value = '';
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            
            // Navigate command history
            if (previousCommands[agentId].length > 0) {
                if (historyPosition[agentId] < previousCommands[agentId].length - 1) {
                    historyPosition[agentId]++;
                }
                
                input.value = previousCommands[agentId][previousCommands[agentId].length - 1 - historyPosition[agentId]];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            
            // Navigate command history
            if (previousCommands[agentId].length > 0 && historyPosition[agentId] > 0) {
                historyPosition[agentId]--;
                input.value = previousCommands[agentId][previousCommands[agentId].length - 1 - historyPosition[agentId]];
            } else if (historyPosition[agentId] === 0) {
                historyPosition[agentId] = -1;
                input.value = '';
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            // TODO: Command completion could be added here
        }
    };
    
    inputContainer.appendChild(prompt);
    inputContainer.appendChild(input);
    
    terminalContainer.appendChild(terminalOutput);
    terminalContainer.appendChild(inputContainer);
    
    modalBody.appendChild(terminalContainer);
    
    // Modal footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    // Clear button
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'btn btn-outline-secondary';
    clearButton.textContent = 'Clear';
    clearButton.onclick = function() {
        terminalOutput.textContent = '';
    };
    
    // Copy button
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'btn btn-outline-primary';
    copyButton.textContent = 'Copy Output';
    copyButton.onclick = function() {
        navigator.clipboard.writeText(terminalOutput.textContent).then(() => {
            showToast('Terminal output copied to clipboard!', 'success');
        });
    };
    
    // Close button
    const closeModalButton = document.createElement('button');
    closeModalButton.type = 'button';
    closeModalButton.className = 'btn btn-secondary';
    closeModalButton.setAttribute('data-bs-dismiss', 'modal');
    closeModalButton.textContent = 'Close';
    
    modalFooter.appendChild(clearButton);
    modalFooter.appendChild(copyButton);
    modalFooter.appendChild(closeModalButton);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modalDialog.appendChild(modalContent);
    modal.appendChild(modalDialog);
    
    document.body.appendChild(modal);
    
    // Return bootstrap modal instance
    return new bootstrap.Modal(modal);
}

// Append text to terminal output
function appendToTerminal(agentId, text) {
    const output = document.getElementById(`terminal-output-${agentId}`);
    if (output) {
        output.textContent += text;
        output.scrollTop = output.scrollHeight;
        
        // Also add to regular output
        appendToOutput(agentId, text, text.startsWith('$'));
    }
}

// Open terminal for an agent
function openAdvancedTerminal(agentId) {
    // Check if terminal already exists
    let terminalModal = bootstrap.Modal.getInstance(document.getElementById(`terminal-modal-${agentId}`));
    
    if (!terminalModal) {
        // Create new terminal
        terminalModal = createAdvancedTerminal(agentId);
        
        // Sync output history
        const output = document.getElementById(`terminal-output-${agentId}`);
        if (output && agentOutputHistory[agentId]) {
            output.textContent = agentOutputHistory[agentId]
                .map(entry => (entry.isPrompt ? `$ ${entry.text}` : entry.text))
                .join('');
        }
    }
    
    // Show terminal
    terminalModal.show();
    
    // Focus input
    setTimeout(() => {
        const input = document.getElementById(`terminal-input-${agentId}`);
        if (input) input.focus();
    }, 500);
}
