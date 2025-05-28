// Dark Mode functionality for the agent dashboard
function toggleDarkMode() {
    const body = document.body;
    const isDarkMode = body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    
    // Update UI elements for dark mode
    updateDarkModeUI(isDarkMode);
}

function updateDarkModeUI(isDarkMode) {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = isDarkMode ? 
            '<i class="bi bi-sun-fill"></i> Light Mode' : 
            '<i class="bi bi-moon-fill"></i> Dark Mode';
    }
    
    // Update all output panels for better contrast in dark mode
    const outputPanels = document.querySelectorAll('[id^="output-"]');
    outputPanels.forEach(panel => {
        if (isDarkMode) {
            panel.style.background = '#111';
            panel.style.color = '#eee';
        } else {
            panel.style.background = '#222';
            panel.style.color = '#eee';
        }
    });
}

// Initialize dark mode on page load
function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        updateDarkModeUI(true);
    } else {
        updateDarkModeUI(false);
    }
}

// Apply dark mode styles
function applyDarkModeStyles() {
    const style = document.createElement('style');
    style.textContent = `
        body.dark-mode {
            background-color: #222;
            color: #eee;
        }
        
        body.dark-mode .card {
            background-color: #333;
            color: #eee;
            border-color: #444;
        }
        
        body.dark-mode .card-header {
            background-color: #444;
            border-color: #555;
        }
        
        body.dark-mode .nav-tabs .nav-link {
            color: #ccc;
        }
        
        body.dark-mode .nav-tabs .nav-link.active {
            background-color: #333;
            color: #fff;
            border-color: #444 #444 #333;
        }
        
        body.dark-mode .form-control {
            background-color: #444;
            color: #eee;
            border-color: #555;
        }
        
        body.dark-mode .form-control:focus {
            background-color: #555;
            color: #fff;
        }
        
        body.dark-mode .btn-outline-primary {
            color: #8ab4f8;
            border-color: #8ab4f8;
        }
        
        body.dark-mode .btn-outline-primary:hover {
            background-color: #8ab4f8;
            color: #222;
        }
        
        body.dark-mode .btn-outline-secondary {
            color: #aaa;
            border-color: #aaa;
        }
        
        body.dark-mode .btn-outline-danger {
            color: #ff7d7d;
            border-color: #ff7d7d;
        }
        
        body.dark-mode .alert-info {
            background-color: #2d4263;
            color: #eee;
            border-color: #2d4263;
        }
    `;
    document.head.appendChild(style);
}
