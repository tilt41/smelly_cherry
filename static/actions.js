// Global actions menu for agent operations

// Create the global actions dropdown
function createGlobalActionsMenu() {
    // Check if it already exists
    if (document.getElementById('globalActionsMenu')) return;
    
    const container = document.createElement('div');
    container.className = 'dropdown d-inline-block';
    container.id = 'globalActionsMenu';
    
    const button = document.createElement('button');
    button.className = 'btn btn-sm btn-outline-primary dropdown-toggle';
    button.type = 'button';
    button.dataset.bsToggle = 'dropdown';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<i class="bi bi-gear"></i> Actions';
    
    const menu = document.createElement('ul');
    menu.className = 'dropdown-menu';
    
    // Actions
    const exportAction = document.createElement('li');
    const exportLink = document.createElement('a');
    exportLink.className = 'dropdown-item';
    exportLink.href = '#';
    exportLink.innerHTML = '<i class="bi bi-download"></i> Export All Agents';
    exportLink.onclick = exportAllAgentsData;
    exportAction.appendChild(exportLink);
    
    const refreshAction = document.createElement('li');
    const refreshLink = document.createElement('a');
    refreshLink.className = 'dropdown-item';
    refreshLink.href = '#';
    refreshLink.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh All Data';
    refreshLink.onclick = refreshAllAgentsData;
    refreshAction.appendChild(refreshLink);
    
    const pingAction = document.createElement('li');
    const pingLink = document.createElement('a');
    pingLink.className = 'dropdown-item';
    pingLink.href = '#';
    pingLink.innerHTML = '<i class="bi bi-broadcast"></i> Ping All Agents';
    pingLink.onclick = pingAllAgents;
    pingAction.appendChild(pingLink);
    
    const divider = document.createElement('li');
    divider.innerHTML = '<hr class="dropdown-divider">';
    
    const deleteAllAction = document.createElement('li');
    const deleteAllLink = document.createElement('a');
    deleteAllLink.className = 'dropdown-item text-danger';
    deleteAllLink.href = '#';
    deleteAllLink.innerHTML = '<i class="bi bi-trash"></i> Delete All Offline Agents';
    deleteAllLink.onclick = deleteAllOfflineAgents;
    deleteAllAction.appendChild(deleteAllLink);
    
    // Assemble menu
    menu.appendChild(exportAction);
    menu.appendChild(refreshAction);
    menu.appendChild(pingAction);
    menu.appendChild(divider);
    menu.appendChild(deleteAllAction);
    
    container.appendChild(button);
    container.appendChild(menu);
    
    return container;
}

// Export all agent data as JSON
function exportAllAgentsData() {
    // Prepare data structure
    const exportData = {
        agents: {},
        exported_at: new Date().toISOString()
    };
    
    // Collect data for each agent
    Object.keys(agentInfoMap).forEach(agentId => {
        exportData.agents[agentId] = {
            info: agentInfoMap[agentId] || {},
            output: agentOutputHistory[agentId] || [],
            tags: agentTags[agentId] || [],
            last_seen: agentLastSeen[agentId] || null,
            templates: commandTemplates.filter(t => t.agentId === agentId) || []
        };
    });
    
    // Convert to JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Create download link
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Agent data exported successfully', 'success');
}

// Refresh all agent data
async function refreshAllAgentsData() {
    showToast('Refreshing all agent data...', 'info');
    
    try {
        // Get all agents
        const resp = await fetch('/api/agents');
        if (resp.ok) {
            const data = await resp.json();
            
            if (data.agents && data.agents.length > 0) {
                let successCount = 0;
                
                // Refresh data for each agent
                for (const id of data.agents) {
                    try {
                        // Fetch agent metadata
                        const infoResp = await fetch(`/api/agent_info/${id}`);
                        if (infoResp.ok) {
                            const info = await infoResp.json();
                            if (info && Object.keys(info).length > 0) {
                                agentInfoMap[id] = info;
                            }
                        }
                        
                        // Fetch output history
                        const outputResp = await fetch(`/api/output/${id}`);
                        if (outputResp.ok) {
                            agentOutputHistory[id] = await outputResp.json();
                        }
                        
                        // Fetch tags
                        const tagsResp = await fetch(`/api/tags/${id}`);
                        if (tagsResp.ok) {
                            const tagsData = await tagsResp.json();
                            agentTags[id] = tagsData.tags || [];
                        }
                        
                        // Fetch command templates
                        await fetchCmdTemplates(id);
                        
                        successCount++;
                    } catch (e) {
                        console.error(`Error refreshing data for agent ${id}:`, e);
                    }
                }
                
                // Re-render the UI
                renderTabs();
                if (currentAgentId) {
                    await showAgentDetails(currentAgentId);
                }
                
                showToast(`Successfully refreshed data for ${successCount} agents`, 'success');
            } else {
                showToast('No agents found to refresh', 'warning');
            }
        } else {
            showToast('Failed to fetch agent list', 'danger');
        }
    } catch (e) {
        console.error('Error refreshing agent data:', e);
        showToast('Error refreshing agent data', 'danger');
    }
}

// Ping all agents to check their status
function pingAllAgents() {
    const onlineCount = Object.keys(agentInfoMap).filter(id => {
        const isOnline = agentLastSeen[id] && (Date.now() - agentLastSeen[id] < 60000);
        return isOnline;
    }).length;
    
    const totalCount = Object.keys(agentInfoMap).length;
    
    if (totalCount === 0) {
        showToast('No agents to ping', 'warning');
        return;
    }
    
    // Only ping online agents
    Object.keys(agentInfoMap).forEach(id => {
        const isOnline = agentLastSeen[id] && (Date.now() - agentLastSeen[id] < 60000);
        
        if (isOnline) {
            // Send a harmless command that works on any OS
            ws.send(JSON.stringify({ agent_id: id, command: 'echo "ping"' }));
        }
    });
    
    showToast(`Pinged ${onlineCount} online agents out of ${totalCount} total`, 'info');
}

// Delete all offline agents
function deleteAllOfflineAgents() {
    const offlineAgents = Object.keys(agentInfoMap).filter(id => {
        const isOnline = agentLastSeen[id] && (Date.now() - agentLastSeen[id] < 60000);
        return !isOnline;
    });
    
    if (offlineAgents.length === 0) {
        showToast('No offline agents to delete', 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${offlineAgents.length} offline agents? This action cannot be undone.`)) {
        return;
    }
    
    // Delete all offline agents
    Promise.all(offlineAgents.map(id => 
        fetch(`/api/agent/${id}`, { method: 'DELETE' })
    ))
    .then(responses => {
        const successCount = responses.filter(r => r.ok).length;
        
        // Clean up frontend
        offlineAgents.forEach(id => {
            delete agentInfoMap[id];
            delete agentOutputHistory[id];
            delete agentLastSeen[id];
            delete agentTags[id];
            
            // Clean up command templates
            commandTemplates = commandTemplates.filter(t => t.agentId !== id);
            
            // Remove from selected agents
            if (selectedAgents.has(id)) {
                selectedAgents.delete(id);
            }
        });
        
        // Switch to another agent if the current one was deleted
        if (offlineAgents.includes(currentAgentId)) {
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
            showAgentDetails(currentAgentId);
        }
        
        showToast(`Successfully deleted ${successCount} offline agents`, 'success');
    })
    .catch(error => {
        console.error('Error deleting offline agents:', error);
        showToast('Error deleting offline agents', 'danger');
    });
}
