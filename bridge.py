import asyncio
import websockets
import socket
import threading

# Bridge between WebSocket (dashboard) and TCP (agent)

AGENT_PORT = 8765
AGENT_HOST = 'localhost'

connected_agents = {}

def tcp_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind((AGENT_HOST, AGENT_PORT))
    s.listen()
    while True:
        conn, addr = s.accept()
        agent_id = conn.recv(1024).decode()
        connected_agents[agent_id] = conn
        threading.Thread(target=handle_agent, args=(conn, agent_id), daemon=True).start()

def handle_agent(conn, agent_id):
    while True:
        try:
            data = conn.recv(4096)
            if not data:
                break
            # Forward output to dashboard (to be implemented)
        except Exception:
            break
    del connected_agents[agent_id]

async def ws_to_agent(websocket, agent_id):
    while True:
        command = await websocket.recv()
        if agent_id in connected_agents:
            connected_agents[agent_id].sendall(command.encode())

async def agent_output_to_ws(websocket, agent_id):
    conn = connected_agents[agent_id]
    while True:
        data = conn.recv(4096)
        if not data:
            break
        await websocket.send(data.decode())

def start_tcp_server():
    threading.Thread(target=tcp_server, daemon=True).start()

start_tcp_server()

# This file is a bridge and should be integrated with dashboard.py for full functionality.
