# Agent Connection Guide

## Error: Connection Refused
If you're seeing a "Connection refused" error, it means the agent cannot reach the bridge server. Here's how to fix it:

1. **Check if the bridge server is running**:
   Make sure your bridge server is running by checking for the process:
   ```
   ps aux | grep bridge_server
   ```

2. **Update the agent's connection settings**:
   Edit the `agent.py` file and update the HOST to the IP address of the server running the bridge:
   ```python
   # Update this to the IP address of your bridge server
   HOST = '192.168.1.x'  # Replace with your server's actual IP
   PORT = 8765           # Make sure this matches the AGENT_PORT in bridge_server.py
   ```

3. **Check firewall settings**:
   Make sure port 8765 is open on your bridge server:
   ```
   sudo ufw status
   ```
   
   If needed, open the port:
   ```
   sudo ufw allow 8765/tcp
   ```

4. **Test connectivity**:
   Test if you can reach the bridge server from the agent machine:
   ```
   nc -zv 192.168.1.x 8765
   ```

5. **Modify the bridge server to listen on all interfaces**:
   In `bridge_server_new.py`, update the AGENT_HOST to listen on all interfaces:
   ```python
   # TCP server for agents
   AGENT_PORT = 8765
   AGENT_HOST = '0.0.0.0'  # Listen on all interfaces instead of just localhost
   ```

## Bridge Server Architecture
- The bridge server has two parts:
  1. A TCP server (port 8765) that agents connect to
  2. A WebSocket server (port 9000) that the dashboard connects to
  
- Make sure both ports are accessible for their respective clients

## Running Agents Remotely
To run an agent on a remote machine:
1. Copy the `agent.py` file to the remote machine
2. Edit the HOST to point to your bridge server
3. Run the agent: `python agent.py`

For better security, consider using SSH tunneling if running over the internet.
