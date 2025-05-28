import { agentInfoMap } from './dashboard.js';

// Search and filtering functionality for the agent dashboard

// Stores current search/filter state
let searchFilters = {
    query: '',
    status: 'all', // 'all', 'online', 'offline'
    tags: []
};

// Filter agents based on search criteria
function filterAgents() {
    const agentIds = Object.keys(agentInfoMap);
    const filteredAgents = agentIds.filter(agentId => {
        const info = agentInfoMap[agentId] || {};
        const tags = agentTags[agentId] || [];
        const isOnline = agentLastSeen[agentId] && (Date.now() - agentLastSeen[agentId] < 60000);
        
        // Status filter
        if (searchFilters.status === 'online' && !isOnline) return false;
        if (searchFilters.status === 'offline' && isOnline) return false;
        
        // Tags filter
        if (searchFilters.tags.length > 0 && !searchFilters.tags.some(tag => tags.includes(tag))) {
            return false;
        }
        
        // Text search (if query exists)
        if (searchFilters.query) {
            const query = searchFilters.query.toLowerCase();
            const hostname = info.hostname || '';
            const os = info.os || '';
            
            // Search in agent ID, hostname, OS, and tags
            return (
                agentId.toLowerCase().includes(query) ||
                hostname.toLowerCase().includes(query) ||
                os.toLowerCase().includes(query) ||
                tags.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        return true;
    });
    
    // Update UI to only show filtered agents
    updateVisibleAgents(filteredAgents);
    return filteredAgents;
}

// Update UI to show only filtered agents
function updateVisibleAgents(filteredIds) {
    // Hide/show tabs based on filter
    const tabs = document.querySelectorAll('#agentTabs li');
    tabs.forEach(tab => {
        const tabButton = tab.querySelector('button.nav-link');
        if (tabButton) {
            const agentId = tabButton.textContent;
            tab.style.display = filteredIds.includes(agentId) ? '' : 'none';
        }
    });
    
    // Hide/show panels based on filter
    const panels = document.querySelectorAll('.tab-pane');
    panels.forEach(panel => {
        const panelId = panel.id;
        if (panelId && panelId.startsWith('panel-')) {
            const agentId = panelId.replace('panel-', '');
            panel.style.display = filteredIds.includes(agentId) ? '' : 'none';
        }
    });
    
    // If current agent is filtered out, switch to the first visible one
    if (currentAgentId && !filteredIds.includes(currentAgentId) && filteredIds.length > 0) {
        switchAgent(filteredIds[0]);
    }
    
    // Show no results message if needed
    const noResults = document.getElementById('noSearchResults');
    if (noResults) {
        if (filteredIds.length === 0 && Object.keys(agentInfoMap).length > 0) {
            noResults.style.display = 'block';
        } else {
            noResults.style.display = 'none';
        }
    }
    
    // Update counter
    const counter = document.getElementById('filteredAgentCount');
    if (counter) {
        counter.textContent = `${filteredIds.length} of ${Object.keys(agentInfoMap).length}`;
    }
}

// Search input handler
function handleSearchInput(e) {
    searchFilters.query = e.target.value.trim();
    filterAgents();
}

// Status filter handler
function handleStatusFilter(status) {
    searchFilters.status = status;
    
    // Update UI
    document.querySelectorAll('.status-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });
    
    filterAgents();
}

// Tag filter handler
function handleTagFilter(tag) {
    const index = searchFilters.tags.indexOf(tag);
    
    if (index === -1) {
        // Add tag to filter
        searchFilters.tags.push(tag);
    } else {
        // Remove tag from filter
        searchFilters.tags.splice(index, 1);
    }
    
    // Update UI
    updateTagFilterUI();
    
    filterAgents();
}

// Update tag filter badges
function updateTagFilterUI() {
    const tagContainer = document.getElementById('tagFilters');
    if (!tagContainer) return;
    
    // Clear container
    tagContainer.innerHTML = '';
    
    // Get all unique tags
    const allTags = new Set();
    Object.keys(agentTags).forEach(agentId => {
        (agentTags[agentId] || []).forEach(tag => {
            if (tag) allTags.add(tag);
        });
    });
    
    // Create tag badges
    Array.from(allTags).sort().forEach(tag => {
        const isActive = searchFilters.tags.includes(tag);
        
        const badge = document.createElement('span');
        badge.className = `badge rounded-pill me-1 mb-1 ${isActive ? 'bg-primary' : 'bg-secondary'}`;
        badge.style.cursor = 'pointer';
        badge.textContent = tag;
        badge.onclick = () => handleTagFilter(tag);
        
        tagContainer.appendChild(badge);
    });
}

// Create search and filter UI
function createSearchUI() {
    // Check if search container already exists
    if (document.getElementById('searchContainer')) return;
    
    const searchContainer = document.createElement('div');
    searchContainer.id = 'searchContainer';
    searchContainer.className = 'card mb-3';
    
    const searchHeader = document.createElement('div');
    searchHeader.className = 'card-header d-flex justify-content-between align-items-center';
    searchHeader.innerHTML = '<span><i class="bi bi-search"></i> Search & Filter</span>';
    
    // Collapse/expand button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'btn btn-sm btn-outline-secondary';
    collapseBtn.innerHTML = '<i class="bi bi-chevron-up"></i>';
    collapseBtn.onclick = () => {
        const body = document.getElementById('searchBody');
        if (body) {
            const isVisible = body.style.display !== 'none';
            body.style.display = isVisible ? 'none' : 'block';
            collapseBtn.innerHTML = isVisible ? 
                '<i class="bi bi-chevron-down"></i>' : 
                '<i class="bi bi-chevron-up"></i>';
        }
    };
    searchHeader.appendChild(collapseBtn);
    
    const searchBody = document.createElement('div');
    searchBody.id = 'searchBody';
    searchBody.className = 'card-body';
    
    // Search input
    const searchRow = document.createElement('div');
    searchRow.className = 'row mb-3';
    
    const searchCol = document.createElement('div');
    searchCol.className = 'col';
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'form-control';
    searchInput.placeholder = 'Search agents by ID, hostname, OS, or tags...';
    searchInput.oninput = handleSearchInput;
    
    const inputGroupText = document.createElement('span');
    inputGroupText.className = 'input-group-text';
    inputGroupText.id = 'filteredAgentCount';
    inputGroupText.textContent = Object.keys(agentInfoMap).length;
    
    inputGroup.appendChild(searchInput);
    inputGroup.appendChild(inputGroupText);
    
    searchCol.appendChild(inputGroup);
    searchRow.appendChild(searchCol);
    
    // Status filter buttons
    const statusRow = document.createElement('div');
    statusRow.className = 'row mb-3';
    
    const statusCol = document.createElement('div');
    statusCol.className = 'col';
    
    const statusGroup = document.createElement('div');
    statusGroup.className = 'btn-group';
    statusGroup.setAttribute('role', 'group');
    
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn btn-outline-secondary status-filter active';
    allBtn.dataset.status = 'all';
    allBtn.textContent = 'All';
    allBtn.onclick = () => handleStatusFilter('all');
    
    const onlineBtn = document.createElement('button');
    onlineBtn.type = 'button';
    onlineBtn.className = 'btn btn-outline-success status-filter';
    onlineBtn.dataset.status = 'online';
    onlineBtn.textContent = 'Online';
    onlineBtn.onclick = () => handleStatusFilter('online');
    
    const offlineBtn = document.createElement('button');
    offlineBtn.type = 'button';
    offlineBtn.className = 'btn btn-outline-secondary status-filter';
    offlineBtn.dataset.status = 'offline';
    offlineBtn.textContent = 'Offline';
    offlineBtn.onclick = () => handleStatusFilter('offline');
    
    statusGroup.appendChild(allBtn);
    statusGroup.appendChild(onlineBtn);
    statusGroup.appendChild(offlineBtn);
    
    statusCol.appendChild(statusGroup);
    statusRow.appendChild(statusCol);
    
    // Tag filters
    const tagRow = document.createElement('div');
    tagRow.className = 'row';
    
    const tagCol = document.createElement('div');
    tagCol.className = 'col';
    
    const tagLabel = document.createElement('div');
    tagLabel.className = 'mb-2';
    tagLabel.innerHTML = '<small class="text-muted">Filter by tags:</small>';
    
    const tagContainer = document.createElement('div');
    tagContainer.id = 'tagFilters';
    
    tagCol.appendChild(tagLabel);
    tagCol.appendChild(tagContainer);
    tagRow.appendChild(tagCol);
    
    // No results message
    const noResults = document.createElement('div');
    noResults.id = 'noSearchResults';
    noResults.className = 'alert alert-info mt-3';
    noResults.style.display = 'none';
    noResults.innerHTML = 'No agents match your search criteria.';
    
    // Assemble search body
    searchBody.appendChild(searchRow);
    searchBody.appendChild(statusRow);
    searchBody.appendChild(tagRow);
    searchBody.appendChild(noResults);
    
    // Assemble search container
    searchContainer.appendChild(searchHeader);
    searchContainer.appendChild(searchBody);
    
    // Insert before batch panel or tabs
    const batchPanel = document.getElementById('batchPanel');
    const tabsContainer = document.getElementById('agentTabs').parentNode;
    
    if (batchPanel) {
        tabsContainer.insertBefore(searchContainer, batchPanel);
    } else {
        tabsContainer.insertBefore(searchContainer, document.getElementById('agentTabs'));
    }
    
    // Initialize tag filters
    updateTagFilterUI();
}
