from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import Depends, status
import uuid
import websockets
import asyncio
import json
import sqlite3
import time
import secrets

app = FastAPI()

# --- SQLITE INIT ---
def get_db():
    conn = sqlite3.connect('dashboard.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS agent_output (
        agent_id TEXT,
        text TEXT,
        is_prompt INTEGER,
        timestamp TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS agent_tags (
        agent_id TEXT PRIMARY KEY,
        tags TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS command_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT,
        text TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS agent_metadata (
        agent_id TEXT PRIMARY KEY,
        info TEXT
    )''')
    conn.commit()
    conn.close()

init_db()

# --- CORS for JS fetch ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store connected agents and dashboard connections
agents = {}
dashboards = set()

# Store connected dashboards
connected_dashboards = set()

# Connect to bridge server instead of direct agent WebSocket
BRIDGE_WS_URL = "ws://127.0.0.1:9000"

# Store latest agent_info for each agent
latest_agent_info = {}

# --- AGENT METADATA PERSISTENCE ---
def save_agent_info(agent_id, info):
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS agent_metadata (
        agent_id TEXT PRIMARY KEY,
        info TEXT
    )''')
    c.execute('INSERT OR REPLACE INTO agent_metadata (agent_id, info) VALUES (?, ?)', (agent_id, json.dumps(info)))
    conn.commit()
    conn.close()

def load_all_agent_info():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS agent_metadata (
        agent_id TEXT PRIMARY KEY,
        info TEXT
    )''')
    c.execute('SELECT agent_id, info FROM agent_metadata')
    rows = c.fetchall()
    conn.close()
    return {row[0]: json.loads(row[1]) for row in rows if row[1]}

# On startup, load all agent info from DB into memory
latest_agent_info = load_all_agent_info()

# --- BASIC AUTH CONFIG ---
security = HTTPBasic()
DASHBOARD_USER = "admin"  # Change as needed
DASHBOARD_PASS = "changeme"  # Change as needed

def authenticate(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, DASHBOARD_USER)
    correct_password = secrets.compare_digest(credentials.password, DASHBOARD_PASS)
    if not (correct_username and correct_password):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# --- PROTECTED ROUTES ---
@app.get("/")
def get(user: str = Depends(authenticate)):
    with open("static/index.html") as f:
        return HTMLResponse(f.read())

@app.get("/guide")
def get_guide(user: str = Depends(authenticate)):
    with open("static/guide.html") as f:
        return HTMLResponse(f.read())

@app.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    # HTTP Basic Auth handshake for WebSocket
    auth = websocket.headers.get("authorization")
    if not auth or not auth.startswith("Basic "):
        await websocket.close(code=4401)
        return
    import base64
    try:
        encoded = auth.split(" ", 1)[1]
        decoded = base64.b64decode(encoded).decode()
        username, password = decoded.split(":", 1)
        if not (secrets.compare_digest(username, DASHBOARD_USER) and secrets.compare_digest(password, DASHBOARD_PASS)):
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    dashboards.add(websocket)  # Add to global dashboards set for direct messaging
    try:
        async with websockets.connect(BRIDGE_WS_URL) as bridge_ws:
            async def forward_to_bridge():
                while True:
                    data = await websocket.receive_json()
                    await bridge_ws.send(json.dumps(data))
            async def forward_to_dashboard():
                while True:
                    msg = await bridge_ws.recv()
                    # Intercept agent_info and store it
                    try:
                        j = json.loads(msg)
                        if j.get('action') == 'agent_info' and 'agent_id' in j:
                            agent_id = j['agent_id']
                            print(f"[DASHBOARD] Received agent_info for {agent_id}")
                            latest_agent_info[agent_id] = j
                            save_agent_info(agent_id, j)
                    except Exception as e:
                        print(f"[DASHBOARD] Error processing message: {e}")
                    await websocket.send_text(msg)
            await asyncio.gather(forward_to_bridge(), forward_to_dashboard())
    except WebSocketDisconnect:
        dashboards.remove(websocket)  # Remove from global set
    except Exception as e:
        print(f"[DASHBOARD] Bridge connection error: {e}")
        import traceback
        traceback.print_exc()
        if websocket in dashboards:
            dashboards.remove(websocket)

@app.get("/api/output/{agent_id}")
def get_output(agent_id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT text, is_prompt, timestamp FROM agent_output WHERE agent_id=?", (agent_id,))
    rows = c.fetchall()
    conn.close()
    return [{"text": r[0], "isPrompt": bool(r[1]), "timestamp": r[2]} for r in rows]

@app.post("/api/output/{agent_id}")
def add_output(agent_id: str, req: Request):
    data = asyncio.run(req.json())
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO agent_output (agent_id, text, is_prompt, timestamp) VALUES (?, ?, ?, ?)",
              (agent_id, data['text'], int(data['isPrompt']), data['timestamp']))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/tags/{agent_id}")
def get_tags(agent_id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT tags FROM agent_tags WHERE agent_id=?", (agent_id,))
    row = c.fetchone()
    conn.close()
    return {"tags": row[0].split(',') if row and row[0] else []}

@app.post("/api/tags/{agent_id}")
def set_tags(agent_id: str, req: Request):
    data = asyncio.run(req.json())
    tags = ','.join(data['tags'])
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO agent_tags (agent_id, tags) VALUES (?, ?)", (agent_id, tags))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/templates/{agent_id}")
def get_templates(agent_id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, text FROM command_templates WHERE agent_id=?", (agent_id,))
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "text": r[1]} for r in rows]

@app.post("/api/templates/{agent_id}")
def add_template(agent_id: str, req: Request):
    data = asyncio.run(req.json())
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO command_templates (agent_id, text) VALUES (?, ?)", (agent_id, data['text']))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/templates/{agent_id}/{tpl_id}")
def delete_template(agent_id: str, tpl_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM command_templates WHERE agent_id=? AND id=?", (agent_id, tpl_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/agents")
def get_agents():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT agent_id FROM agent_metadata')
    rows = c.fetchall()
    conn.close()
    return {"agents": [row[0] for row in rows]}

@app.get("/api/agent_info/{agent_id}")
def get_agent_info(agent_id: str):
    # Always try to load from DB first to ensure latest data
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT info FROM agent_metadata WHERE agent_id=?', (agent_id,))
    row = c.fetchone()
    conn.close()
    
    if row and row[0]:
        try:
            dbinfo = json.loads(row[0])
            # Update in-memory cache
            latest_agent_info[agent_id] = dbinfo
            print(f"[DEBUG] Loaded agent info from DB for {agent_id}: {dbinfo}")
            return dbinfo
        except json.JSONDecodeError:
            print(f"[ERROR] Failed to decode JSON for agent {agent_id}")
            # If JSON is invalid, try memory cache
            info = latest_agent_info.get(agent_id)
            if info:
                return info
    else:
        print(f"[DEBUG] No data in DB for agent {agent_id}")
    
    # Fallback to memory if not in DB
    info = latest_agent_info.get(agent_id)
    if info:
        print(f"[DEBUG] Using cached info for {agent_id}: {info}")
        return info
        
    # Nothing found
    print(f"[DEBUG] No info found for {agent_id}, returning empty dict")
    return {}

@app.delete("/api/agent/{agent_id}")
def delete_agent(agent_id: str):
    """Delete an agent and all associated data (metadata, output, tags, templates)"""
    conn = get_db()
    c = conn.cursor()
    try:
        # Delete agent metadata
        c.execute('DELETE FROM agent_metadata WHERE agent_id=?', (agent_id,))
        # Delete agent output history
        c.execute('DELETE FROM agent_output WHERE agent_id=?', (agent_id,))
        # Delete agent tags
        c.execute('DELETE FROM agent_tags WHERE agent_id=?', (agent_id,))
        # Delete agent command templates
        c.execute('DELETE FROM command_templates WHERE agent_id=?', (agent_id,))
        # Remove from in-memory cache
        if agent_id in latest_agent_info:
            del latest_agent_info[agent_id]
        conn.commit()
        print(f"[INFO] Deleted agent {agent_id} from database")
        return {"ok": True, "message": f"Agent {agent_id} deleted successfully"}
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Failed to delete agent {agent_id}: {e}")
        return {"ok": False, "message": f"Failed to delete agent: {str(e)}"}, 500
    finally:
        conn.close()

@app.get("/agent.py")
def download_agent():
    return FileResponse("agent.py", media_type="text/x-python", filename="agent.py")

app.mount("/static", StaticFiles(directory="static"), name="static")
