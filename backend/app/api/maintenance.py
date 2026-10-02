import docker
import secrets
import string
import time
import threading
import socket
from flask import Blueprint, request, jsonify, render_template_string, session

maintenance_bp = Blueprint('maintenance', __name__, url_prefix='/api/maintenance')

# ── Configuración ─────────────────────────────────────────────────────────────
DOCKER_IMAGE = "ctf-participantes"
NETWORK_NAME = "ctf_network"
PORT_RANGE   = range(5001, 5051)
DEFAULT_TTL  = 3600   # 1 hora
EXTEND_TIME  = 1800   # +30 min

try:
    docker_client = docker.from_env()
    DOCKER_AVAILABLE = True
except Exception:
    docker_client = None
    DOCKER_AVAILABLE = False

# Estado en memoria: { session_id → { container_id, port, password, expire_at } }
active_instances: dict = {}
_lock = threading.Lock()

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_host_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

def get_free_port():
    used = {v['port'] for v in active_instances.values()}
    for p in PORT_RANGE:
        if p not in used:
            return p
    return None

def generate_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def get_session_key() -> str:
    """Clave de sesión estable basada en la sesión de Flask del portal."""
    if 'maint_id' not in session:
        session['maint_id'] = secrets.token_hex(16)
    return session['maint_id']

# ── Garbage Collector ─────────────────────────────────────────────────────────

def _garbage_collector():
    while True:
        time.sleep(30)
        now = time.time()
        expired = []
        with _lock:
            for key, data in list(active_instances.items()):
                if now >= data['expire_at']:
                    expired.append((key, data['container_id']))
        for key, cid in expired:
            print(f"[maintenance] TTL expirado → destruyendo {cid[:12]}")
            try:
                if docker_client:
                    c = docker_client.containers.get(cid)
                    c.remove(force=True)
            except Exception as e:
                print(f"[maintenance] Error GC: {e}")
            finally:
                with _lock:
                    active_instances.pop(key, None)

_gc_thread = threading.Thread(target=_garbage_collector, daemon=True)
_gc_thread.start()

# ── HTML del Portal (igual al index.html de referencia) ───────────────────────

PORTAL_HTML = r"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SISTEMA SCADA // MANTENIMIENTO PLANTA DE GAS</title>
    <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #05080c;
            --card-bg: rgba(10, 16, 24, 0.95);
            --border-color: #1e293b;
            --accent-green: #00ff88;
            --accent-cyan: #00e5ff;
            --accent-red: #ff3344;
            --accent-amber: #ffb700;
            --text-primary: #e2e8f0;
            --text-muted: #64748b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Chakra Petch', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .bg-grid {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-image:
                linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
            background-size: 30px 30px;
            pointer-events: none; z-index: 0;
        }
        .container { position: relative; z-index: 1; width: 100%; max-width: 680px; }
        .header { text-align: center; margin-bottom: 25px; }
        .badge-status {
            display: inline-flex; align-items: center; gap: 8px;
            background: rgba(0, 229, 255, 0.1);
            border: 1px solid rgba(0, 229, 255, 0.3);
            color: var(--accent-cyan); padding: 5px 14px;
            border-radius: 999px; font-size: 0.78rem; font-weight: 700;
            letter-spacing: 1.5px; margin-bottom: 12px;
        }
        .dot-pulse {
            width: 8px; height: 8px; background: var(--accent-cyan);
            border-radius: 50%; box-shadow: 0 0 10px var(--accent-cyan);
            animation: pulse 1.5s infinite;
        }
        .title {
            font-size: 1.8rem; font-weight: 700; letter-spacing: 2px;
            text-transform: uppercase; color: #fff;
            text-shadow: 0 0 20px rgba(0, 229, 255, 0.2);
        }
        .subtitle {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;
        }
        .card {
            background: var(--card-bg); border: 1.5px solid var(--border-color);
            border-radius: 12px; padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,229,255,0.02);
            position: relative; overflow: hidden;
        }
        .card::before {
            content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, var(--accent-cyan), transparent);
        }
        .spawn-box { text-align: center; padding: 20px 0; }
        .spawn-desc { font-size: 0.95rem; color: #94a3b8; margin-bottom: 25px; line-height: 1.5; }
        .btn-spawn {
            background: var(--accent-cyan); color: #05080c; border: none;
            padding: 14px 32px; font-size: 1.05rem; font-family: 'Chakra Petch', sans-serif;
            font-weight: 700; letter-spacing: 1.5px; border-radius: 6px; cursor: pointer;
            transition: all 0.2s ease; box-shadow: 0 0 20px rgba(0, 229, 255, 0.4);
        }
        .btn-spawn:hover { background: #55eeff; box-shadow: 0 0 30px rgba(0,229,255,0.8); transform: translateY(-2px); }
        .btn-spawn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .active-box { display: none; }
        .timer-container {
            display: flex; justify-content: space-between; align-items: center;
            background: rgba(0,0,0,0.4); border: 1px solid var(--border-color);
            padding: 12px 18px; border-radius: 8px; margin-bottom: 20px;
        }
        .timer-label { font-size: 0.8rem; color: var(--text-muted); }
        .timer-val { font-family: 'Share Tech Mono', monospace; font-size: 1.3rem; color: var(--accent-amber); font-weight: bold; }
        .cred-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
        .cred-item { background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: 6px; }
        .cred-label { display: block; font-size: 0.72rem; color: var(--text-muted); font-family: 'Share Tech Mono', monospace; margin-bottom: 4px; }
        .cred-val { font-family: 'Share Tech Mono', monospace; font-size: 1rem; color: var(--accent-cyan); font-weight: bold; }
        .ssh-box {
            background: #020406; border: 1px solid var(--accent-cyan);
            border-radius: 6px; padding: 14px; margin-bottom: 22px;
            position: relative; cursor: pointer; transition: background 0.2s;
        }
        .ssh-box:hover { background: rgba(0, 229, 255, 0.05); }
        .ssh-label { font-size: 0.7rem; color: var(--accent-cyan); letter-spacing: 1px; display: block; margin-bottom: 6px; }
        .ssh-cmd { font-family: 'Share Tech Mono', monospace; font-size: 0.95rem; color: #fff; word-break: break-all; }
        .copy-hint { position: absolute; top: 10px; right: 12px; font-size: 0.7rem; color: var(--text-muted); }
        .actions-row { display: flex; gap: 12px; }
        .btn-action {
            flex: 1; padding: 11px; border-radius: 6px;
            font-family: 'Chakra Petch', sans-serif; font-weight: 700;
            font-size: 0.85rem; letter-spacing: 1px; cursor: pointer;
            border: 1px solid transparent; transition: all 0.2s;
        }
        .btn-extend { background: rgba(0,255,136,0.15); border-color: var(--accent-green); color: var(--accent-green); }
        .btn-extend:hover { background: var(--accent-green); color: #05080c; }
        .btn-destroy { background: rgba(255,51,68,0.15); border-color: var(--accent-red); color: var(--accent-red); }
        .btn-destroy:hover { background: var(--accent-red); color: white; }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.9); }
        }
    </style>
</head>
<body>
    <div class="bg-grid"></div>
    <div class="container">
        <div class="header">
            <div class="badge-status">
                <span class="dot-pulse"></span>
                <span>SISTEMA SCADA - MANTENIMIENTO OT</span>
            </div>
            <h1 class="title">PLANTA DE GAS: ESTACIÓN DE COMPRESORES</h1>
            <p class="subtitle">PORTAL DE DIAGNÓSTICO // ACCESO SEGURO ON-DEMAND</p>
        </div>

        <div class="card">
            <div id="spawnView" class="spawn-box">
                <p class="spawn-desc">
                    Al solicitar acceso se desplegará una terminal de diagnóstico aislada con acceso por SSH a los equipos de la planta.
                    La sesión de mantenimiento cuenta con una duración de <strong>1 hora</strong> (prorrogable).
                </p>
                <button class="btn-spawn" id="btnSpawn" onclick="spawnInstance()">
                    [ INICIAR SESIÓN DE MANTENIMIENTO ]
                </button>
            </div>

            <div id="activeView" class="active-box">
                <div class="timer-container">
                    <span class="timer-label">TIEMPO RESTANTE DE SESIÓN:</span>
                    <span class="timer-val" id="timeRemaining">--:--</span>
                </div>
                <div class="cred-grid">
                    <div class="cred-item">
                        <span class="cred-label">HOST / IP:</span>
                        <span class="cred-val" id="credHost">--</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">PUERTO SSH:</span>
                        <span class="cred-val" id="credPort">----</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">USUARIO:</span>
                        <span class="cred-val">tech_admin</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">CONTRASEÑA:</span>
                        <span class="cred-val" id="credPass">--------</span>
                    </div>
                </div>
                <div class="ssh-box" onclick="copySSHCommand()">
                    <span class="ssh-label">COMANDO DE CONEXIÓN RÁPIDA:</span>
                    <div class="ssh-cmd" id="sshCommand">ssh tech_admin@...</div>
                    <span class="copy-hint" id="copyHint">Clic para copiar</span>
                </div>
                <div class="actions-row">
                    <button class="btn-action btn-extend" onclick="extendInstance()">+30 MINUTOS</button>
                    <button class="btn-action btn-destroy" onclick="destroyInstance()">CERRAR SESIÓN</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const HOST_IP = '{{ host_ip }}';
        let remainingSeconds = 0;
        let timerInterval = null;

        async function checkStatus() {
            try {
                const res = await fetch('/api/maintenance/status');
                const data = await res.json();
                if (data.active) {
                    showActiveView(data.port, data.password, data.remaining_seconds);
                } else {
                    showSpawnView();
                }
            } catch(e) {
                showSpawnView();
            }
        }

        function showSpawnView() {
            clearInterval(timerInterval);
            document.getElementById('spawnView').style.display = 'block';
            document.getElementById('activeView').style.display = 'none';
        }

        function showActiveView(port, pass, seconds) {
            document.getElementById('spawnView').style.display = 'none';
            document.getElementById('activeView').style.display = 'block';
            document.getElementById('credHost').innerText = HOST_IP;
            document.getElementById('credPort').innerText = port;
            document.getElementById('credPass').innerText = pass;
            document.getElementById('sshCommand').innerText = `ssh tech_admin@${HOST_IP} -p ${port}`;
            remainingSeconds = seconds;
            updateTimerDisplay();
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                remainingSeconds--;
                if (remainingSeconds <= 0) { clearInterval(timerInterval); checkStatus(); }
                else { updateTimerDisplay(); }
            }, 1000);
        }

        function updateTimerDisplay() {
            const m = Math.floor(remainingSeconds / 60);
            const s = remainingSeconds % 60;
            document.getElementById('timeRemaining').innerText =
                `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }

        async function spawnInstance() {
            const btn = document.getElementById('btnSpawn');
            btn.innerText = 'INICIALIZANDO TERMINAL SCADA...';
            btn.disabled = true;
            try {
                const res = await fetch('/api/maintenance/spawn', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    checkStatus();
                } else {
                    alert(data.error || 'Error al desplegar instancia');
                    btn.innerText = '[ INICIAR SESIÓN DE MANTENIMIENTO ]';
                    btn.disabled = false;
                }
            } catch(e) {
                alert('Error de conexión con la planta: ' + e.message);
                btn.innerText = '[ INICIAR SESIÓN DE MANTENIMIENTO ]';
                btn.disabled = false;
            }
        }

        async function extendInstance() {
            try {
                const res = await fetch('/api/maintenance/extend', { method: 'POST' });
                const data = await res.json();
                if (data.success) { checkStatus(); }
            } catch(e) {}
        }

        async function destroyInstance() {
            if (!confirm('¿Seguro que deseas cerrar la sesión de mantenimiento?')) return;
            try {
                const res = await fetch('/api/maintenance/destroy', { method: 'POST' });
                const data = await res.json();
                if (data.success) { showSpawnView(); }
            } catch(e) {}
        }

        function copySSHCommand() {
            const cmd = document.getElementById('sshCommand').innerText;
            navigator.clipboard.writeText(cmd);
            const hint = document.getElementById('copyHint');
            hint.innerText = '¡Copiado!';
            hint.style.color = '#00e5ff';
            setTimeout(() => { hint.innerText = 'Clic para copiar'; hint.style.color = '#64748b'; }, 1500);
        }

        document.addEventListener('DOMContentLoaded', checkStatus);
    </script>
</body>
</html>"""

# ── Rutas (sin JWT — el portal usa sesiones de Flask) ────────────────────────

@maintenance_bp.route('/portal')
def portal():
    host_ip = get_host_ip()
    return render_template_string(PORTAL_HTML, host_ip=host_ip)


@maintenance_bp.route('/status')
def status():
    key = get_session_key()
    instance = active_instances.get(key)
    if not instance:
        return jsonify({"active": False})
    remaining = max(0, int(instance['expire_at'] - time.time()))
    return jsonify({
        "active": True,
        "port": instance['port'],
        "password": instance['password'],
        "remaining_seconds": remaining
    })


@maintenance_bp.route('/spawn', methods=['POST'])
def spawn():
    if not DOCKER_AVAILABLE:
        return jsonify({"success": False, "error": "Docker no disponible en este entorno."}), 503

    key = get_session_key()
    with _lock:
        if key in active_instances:
            return jsonify({"success": True, "message": "Ya tienes una instancia activa."})

        port = get_free_port()
        if not port:
            return jsonify({"success": False, "error": "No hay puertos disponibles."}), 503

        password = generate_password()
        container_name = f"maint_{key[:8]}_{port}"

        try:
            container = docker_client.containers.run(
                DOCKER_IMAGE,
                name=container_name,
                network=NETWORK_NAME,
                ports={'22/tcp': port},
                detach=True,
                remove=False
            )
            container.exec_run(
                f"sh -c \"echo 'tech_admin:{password}' | chpasswd\"",
                user="root"
            )
            active_instances[key] = {
                "container_id": container.id,
                "port": port,
                "password": password,
                "expire_at": time.time() + DEFAULT_TTL,
                "container_name": container_name
            }
            print(f"[maintenance] Instancia {container_name} creada (Puerto: {port})")
            return jsonify({"success": True})

        except Exception as e:
            print(f"[maintenance] Error spawn: {e}")
            return jsonify({"success": False, "error": str(e)}), 500


@maintenance_bp.route('/extend', methods=['POST'])
def extend():
    key = get_session_key()
    with _lock:
        if key in active_instances:
            active_instances[key]['expire_at'] += EXTEND_TIME
            return jsonify({"success": True})
    return jsonify({"success": False, "error": "Instancia no encontrada."}), 404


@maintenance_bp.route('/destroy', methods=['POST'])
def destroy():
    key = get_session_key()
    with _lock:
        data = active_instances.pop(key, None)
    if data:
        try:
            if docker_client:
                c = docker_client.containers.get(data['container_id'])
                c.remove(force=True)
                print(f"[maintenance] Contenedor {data['container_name']} destruido.")
        except Exception as e:
            print(f"[maintenance] Error destroy: {e}")
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Instancia no encontrada."}), 404
