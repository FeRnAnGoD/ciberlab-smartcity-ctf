import docker
import secrets
import string
import time
import threading
import socket
from flask import Flask, render_template, request, session, jsonify, redirect, url_for

app = Flask(__name__)
app.secret_key = "ll41tun_l4unch3r_s3cur3_k3y_2026"

# Configuración del Launcher
DOCKER_IMAGE = "ctf-participantes"
NETWORK_NAME = "ctf_network"
PORT_RANGE = range(5001, 5051) # Puertos SSH disponibles (50 slots)
DEFAULT_TTL = 3600             # 1 hora (60 minutos)
EXTEND_TIME = 1800             # 30 minutos

# Conexión local al socket Docker
client = docker.from_env()

# Estructura en memoria: { session_id: { container_id, port, password, expire_at, ip } }
active_instances = {}
lock = threading.Lock()

def get_host_ip():
    """Obtiene la IP local principal de la máquina"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def get_free_port():
    """Busca un puerto SSH que no esté en uso por ninguna instancia activa"""
    used_ports = {inst["port"] for inst in active_instances.values()}
    for port in PORT_RANGE:
        if port not in used_ports:
            return port
    return None

def generate_password(length=10):
    """Genera una contraseña alfanumérica segura"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def garbage_collector():
    """Hilo en segundo plano: destruye contenedores que superaron su tiempo límite"""
    while True:
        time.sleep(15)
        now = time.time()
        expired_sessions = []

        with lock:
            for sess_id, data in list(active_instances.items()):
                if now >= data["expire_at"]:
                    expired_sessions.append((sess_id, data["container_id"]))

        for sess_id, cont_id in expired_sessions:
            print(f"[*] TTL expirado para sesión {sess_id[:8]}... Destruyendo contenedor {cont_id[:12]}")
            try:
                c = client.containers.get(cont_id)
                c.remove(force=True)
            except Exception as e:
                print(f"[!] Error eliminando contenedor expirado: {e}")
            finally:
                with lock:
                    active_instances.pop(sess_id, None)

# Iniciar el hilo recolector
reaper_thread = threading.Thread(target=garbage_collector, daemon=True)
reaper_thread.start()

# ================= RUTAS WEB =================

@app.route("/")
def index():
    if "session_id" not in session:
        session["session_id"] = secrets.token_hex(16)
    
    sess_id = session["session_id"]
    instance = active_instances.get(sess_id)
    host_ip = get_host_ip()

    return render_template("index.html", instance=instance, host_ip=host_ip)

@app.route("/api/spawn", methods=["POST"])
def spawn_instance():
    sess_id = session.get("session_id")
    if not sess_id:
        return jsonify({"success": False, "message": "Sesión inválida"}), 400

    with lock:
        if sess_id in active_instances:
            return jsonify({"success": True, "message": "Ya tienes una instancia activa"})

        port = get_free_port()
        if not port:
            return jsonify({"success": False, "message": "No hay puertos disponibles en el servidor"}), 503

        password = generate_password()
        container_name = f"inst_{sess_id[:8]}_{port}"

        try:
            # 1. Crear el contenedor Docker dinámicamente
            container = client.containers.run(
                DOCKER_IMAGE,
                name=container_name,
                network=NETWORK_NAME,
                ports={'22/tcp': port},
                detach=True,
                remove=False
            )

            # 2. Configurar la contraseña aleatoria para tech_admin
            set_pwd_cmd = f"echo 'tech_admin:{password}' | chpasswd"
            container.exec_run(f"sh -c \"{set_pwd_cmd}\"", user="root")

            # 3. Guardar estado de la instancia (1 hora inicial)
            expire_at = time.time() + DEFAULT_TTL
            active_instances[sess_id] = {
                "container_id": container.id,
                "port": port,
                "password": password,
                "expire_at": expire_at,
                "container_name": container_name
            }

            print(f"[+] Instancia {container_name} creada (Puerto: {port} | TTL: 60 min)")
            return jsonify({"success": True})

        except Exception as e:
            print(f"[!] Error levantando contenedor: {e}")
            return jsonify({"success": False, "message": f"Error Docker: {str(e)}"}), 500

@app.route("/api/extend", methods=["POST"])
def extend_instance():
    sess_id = session.get("session_id")
    with lock:
        if sess_id in active_instances:
            # Sumar 30 minutos al tiempo de expiración
            active_instances[sess_id]["expire_at"] += EXTEND_TIME
            print(f"[+] Sesión {sess_id[:8]} extendida por 30 minutos.")
            return jsonify({"success": True})
    return jsonify({"success": False, "message": "Instancia no encontrada"}), 404

@app.route("/api/destroy", methods=["POST"])
def destroy_instance():
    sess_id = session.get("session_id")
    with lock:
        data = active_instances.pop(sess_id, None)
        if data:
            try:
                c = client.containers.get(data["container_id"])
                c.remove(force=True)
                print(f"[+] Contenedor {data['container_name']} destruido por el usuario.")
            except Exception as e:
                print(f"[!] Error al destruir: {e}")
            return jsonify({"success": True})
    return jsonify({"success": False, "message": "Instancia no encontrada"}), 404

@app.route("/api/status")
def status():
    sess_id = session.get("session_id")
    instance = active_instances.get(sess_id)
    if not instance:
        return jsonify({"active": False})
    
    remaining = max(0, int(instance["expire_at"] - time.time()))
    return jsonify({
        "active": True,
        "port": instance["port"],
        "password": instance["password"],
        "remaining_seconds": remaining
    })

if __name__ == "__main__":
    # El launcher se publica en el puerto 8080
    app.run(host="0.0.0.0", port=8080, debug=False)
