# Agent Management Dashboard

A robust, persistent agent management dashboard with a FastAPI backend and JavaScript/HTML frontend where agents connect to a bridge server. The dashboard allows users to interact with agents, send commands, transfer files, and view agent metadata. All agent data (metadata, output, tags, templates) is stored in SQLite and persists across refreshes, new tabs, and backend restarts.

## Features

- **Persistent Agent Data**: All agent information is stored in SQLite and persists across refreshes and backend restarts
- **Persistent Agent IDs**: Agents automatically maintain their identity across restarts
- **Search & Filtering**: Find agents by hostname, ID, OS, tags, or online status
- **Batch Operations**: Execute commands on multiple agents simultaneously
- **Advanced Terminal**: Full-featured terminal emulation with command history
- **File Transfer**: Upload and download files from agents
- **Dark Mode**: Customizable dark mode for reduced eye strain
- **Tag Management**: Organize agents with custom tags
- **Command Templates**: Save and reuse common commands
- **Bulk Actions**: Export, ping, or delete multiple agents at once

## Getting Started

### Prerequisites

- Python 3.8+
- Pip
- SQLite

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tilt41/smelly_cherry.git
   cd smelly_cherry
   ```

2. Install the requirements:
   ```bash
   pip install fastapi uvicorn websockets
   ```

3. Start the bridge server:
   ```bash
   python bridge_server.py
   ```

4. Start the dashboard:
   ```bash
   uvicorn dashboard:app --host 0.0.0.0 --port 80 --reload
   ```

5. Connect agents:
   ```bash
   python agent.py
   ```

   To use a custom ID (for persistence):
   ```bash
   python agent.py my-custom-id
   ```
   

### Usage

1. Access the dashboard at `http://localhost:8000`
2. View connected agents in the dashboard
3. Select an agent to view details and send commands
4. Use the search box to filter agents
5. Use batch operations to manage multiple agents

## Architecture

- **dashboard.py**: FastAPI server that hosts the web interface and manages agent data
- **bridge_server.py**: Handles connections between agents and the dashboard
- **agent.py**: Client that runs on remote systems and connects to the bridge
- **static/dashboard.js**: Main frontend logic
- **dashboard.db**: SQLite database for persistent storage

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FastAPI
- Bootstrap
- Chart.js
- SQLite
