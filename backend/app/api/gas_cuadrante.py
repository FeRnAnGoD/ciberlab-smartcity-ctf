import os
import sys
import subprocess
import uuid
import time
import threading
import paho.mqtt.client as mqtt_client
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models import Message

gas_bp = Blueprint('gas', __name__)

MORSE_MAP = {
    'F': '..-.', 'L': '.-..', 'A': '.-', 'G': '--.', '{': '-.--.-',
    'X': '-..-', 'S': '...', '_': '..--.-', 'M': '--', 'O': '---',
    'R': '.-.', 'E': '.', 'P': '.--.', '2': '..---', '}': '-.--.-'
}

FLAG_OT = "FLAG{xss_morse_p2}"

# Configuración de conexión hacia la Raspberry Pi (maqueta física)
RASPBERRY_OT_URL = os.environ.get('RASPBERRY_OT_URL', 'http://10.10.20.67:5050')

def dispatch_ot_request(endpoint, payload):
    """Envía peticiones asíncronas hacia la Raspberry Pi sin bloquear el backend web."""
    def _send():
        try:
            import requests
            url = f"{RASPBERRY_OT_URL.rstrip('/')}/{endpoint.lstrip('/')}"
            requests.post(url, json=payload, timeout=2.0)
            print(f"[OT DISPATCH -> RASPI] Comando enviado a {url}: {payload}")
        except Exception as e:
            print(f"[OT DISPATCH] No se pudo conectar a la Raspberry en {RASPBERRY_OT_URL}: {e}")

    threading.Thread(target=_send, daemon=True).start()

@gas_bp.route('/status', methods=['GET'])
@jwt_required()
def get_status():
    return jsonify({
        'presion': 450,
        'estado': 'Operación Normal',
        'alertas': 0
    })

@gas_bp.route('/control', methods=['POST'])
@jwt_required()
def execute_control():
    claims = get_jwt()
    if claims.get('role', '').lower() != 'admin':
        return jsonify({'msg': 'Acceso denegado. Se requiere rol de Admin.'}), 403
        
    data = request.get_json() or {}
    accion = data.get('accion', '')

    # Notificar a la Raspberry Pi si se interactúa con el chiller
    if 'chiller' in str(accion).lower():
        activo = data.get('activo', True)
        dispatch_ot_request('/ot/chiller', {"activo": activo})

    return jsonify({'msg': f'Comando [{accion}] ejecutado exitosamente en la planta.'}), 200

@gas_bp.route('/plant2/alert/autoignition', methods=['POST'])
def trigger_autoignition_alert():
    """Recibe la alerta crítica del SCADA (>= 400°C) y la despacha a la Raspberry Pi."""
    data = request.get_json(silent=True) or {}
    active = data.get('active', True)
    temp = float(data.get('temperature', 400.0))

    # Notificar a la Raspberry Pi para encender/apagar el parpadeo rojo de la tira de 120 LEDs
    dispatch_ot_request('/ot/alerta', {
        "tipo": "autoignicion",
        "activo": active,
        "temperatura": temp
    })

    return jsonify({"status": "Alerta de autoignición despachada a subsistema OT", "activo": active}), 200

@gas_bp.route('/plant2/test-raspi', methods=['GET'])
def test_raspi_connection():
    """Endpoint de diagnóstico rápido para verificar si el notebook puede comunicarse con la Raspberry Pi."""
    import requests
    target = f"{RASPBERRY_OT_URL.rstrip('/')}/ot/status"
    try:
        r = requests.get(target, timeout=3.0)
        return jsonify({
            "status": "CONECTADO CON EXITO",
            "raspberry_url": RASPBERRY_OT_URL,
            "codigo_http": r.status_code,
            "respuesta_raspi": r.json()
        }), 200
    except Exception as e:
        return jsonify({
            "status": "FALLO DE CONEXION",
            "raspberry_url": RASPBERRY_OT_URL,
            "error": str(e),
            "diagnostico": "El backend no pudo comunicarse con la Raspberry Pi. Verifica que la IP sea la correcta y que 'sudo python3 servidor_ot.py' este corriendo en la Raspberry."
        }), 502

@gas_bp.route('/maintenance/launch', methods=['POST', 'GET'])
@jwt_required(optional=True)
def launch_maintenance_service():
    r"""
    Inicia la instancia del portal de mantenimiento (launcher Docker en ctf-planta-gas/launcher/app.py)
    si aún no está en ejecución y devuelve la URL para abrir la ventana.
    Solo accesible para usuarios con rol 'admin'.
    """
    claims = get_jwt() or {}
    if claims and claims.get('role') and claims.get('role', '').lower() != 'admin':
        return jsonify({'error': 'Acceso denegado. Se requiere rol de Administrador para mantenimiento.'}), 403

    # Buscar la carpeta del launcher dinámicamente
    search_dirs = [
        os.path.abspath(os.path.join(current_app.root_path, '..', '..', 'ctf-planta-gas', 'launcher')),
        os.path.abspath(os.path.join(os.getcwd(), 'ctf-planta-gas', 'launcher')),
        os.path.abspath(os.path.join(os.getcwd(), '..', 'ctf-planta-gas', 'launcher')),
        r"c:\Users\Fernando\Desktop\ciberlab_smartcity\ctf-planta-gas\launcher",
        r"D:\ctf-planta-gas\launcher"
    ]
    launcher_dir = None
    for d in search_dirs:
        if os.path.exists(os.path.join(d, "app.py")):
            launcher_dir = d
            break

    # 1. Comprobar si el launcher ya está respondiendo en el puerto 8080
    is_running = False
    try:
        import requests
        r = requests.get("http://127.0.0.1:8080/", timeout=1.0)
        if r.status_code == 200:
            is_running = True
    except Exception:
        is_running = False

    # 2. Si no está corriendo, ejecutar app.py en segundo plano
    if not is_running:
        if not launcher_dir:
            return jsonify({
                'error': 'No se encontró el script app.py de ctf-planta-gas/launcher en las rutas esperadas.'
            }), 404

        try:
            creationflags = 0
            if sys.platform == 'win32':
                creationflags = subprocess.CREATE_NEW_CONSOLE

            subprocess.Popen(
                [sys.executable, "app.py"],
                cwd=launcher_dir,
                creationflags=creationflags
            )

            # Esperar hasta 8 segundos a que el servidor Flask encienda
            for _ in range(25):
                time.sleep(0.3)
                try:
                    import requests
                    r = requests.get("http://127.0.0.1:8080/", timeout=1.0)
                    if r.status_code == 200:
                        is_running = True
                        break
                except Exception:
                    pass
        except Exception as e:
            return jsonify({'error': f'Error al iniciar app.py de mantenimiento: {str(e)}'}), 500

    if not is_running:
        return jsonify({
            'error': 'El servidor de mantenimiento fue lanzado pero no respondió a tiempo en el puerto 8080.'
        }), 504

    return jsonify({
        'success': True,
        'url': 'http://localhost:8080',
        'status': 'Servicio de mantenimiento activo',
        'message': 'Instancia de mantenimiento iniciada exitosamente.'
    }), 200

def blink_led_morse(flag_text):
    """Controla físicamente el LED de Planta 2 en la maqueta y la tira LED"""
    print(f"[OT HARDWARE] Iniciando secuencia Morse para Planta 2...")
    # Despachar también a la Raspberry Pi para reproducirlo en la tira LED
    dispatch_ot_request('/ot/morse', {"flag": flag_text})
    
    for char in flag_text.upper():
        code = MORSE_MAP.get(char, '')
        for symbol in code:
            print(f"[LED P2] ON ({symbol})")
            time.sleep(0.2 if symbol == '.' else 0.6)
            print(f"[LED P2] OFF")
            time.sleep(0.2)
        time.sleep(0.6)
    print("[OT HARDWARE] Secuencia finalizada.")

@gas_bp.route('/plant2/trigger-morse-alert', methods=['POST'])
@jwt_required()
def trigger_morse_alert():
    claims = get_jwt()
    if claims.get('role', '').lower() != 'admin':
        return jsonify({"error": "No autorizado. Requiere rol de Admin"}), 403

    threading.Thread(target=blink_led_morse, args=(FLAG_OT,)).start()
    return jsonify({"status": "Secuencia de diagnóstico iniciada en Planta 2"}), 200

@gas_bp.route('/reports/list', methods=['GET'])
def list_reports():
    """Devuelve la lista de reportes disponibles para descarga."""
    reports_dir = os.path.join(current_app.root_path, 'reports')
    try:
        if not os.path.exists(reports_dir):
            os.makedirs(reports_dir, exist_ok=True)
        files = [f for f in os.listdir(reports_dir)
                 if os.path.isfile(os.path.join(reports_dir, f))]
        return jsonify({"reports": files}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@gas_bp.route('/reports/download', methods=['GET'])
def download_report():
    """
    Endpoint para descargar reportes de la planta.
    VULNERABILIDAD INTENCIONAL (CTF): El parámetro 'file' no valida
    secuencias '../', permitiendo leer archivos arbitrarios del servidor
    fuera del directorio reports/ (Path Traversal / Directory Traversal).
    """
    filename = request.args.get('file', '')

    if not filename:
        return jsonify({"error": "Parámetro 'file' requerido"}), 400

    reports_dir = os.path.join(current_app.root_path, 'reports')
    # Normalizar ruta para resolver secuencias '../' en Windows y Linux
    file_path = os.path.normpath(os.path.join(reports_dir, filename))

    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_file(file_path, as_attachment=True)

    return jsonify({"error": f"Archivo no encontrado: {filename}"}), 404

####################################################################
# --- MANEJO DE TOKEN EN ARCHIVO (PERSISTENCIA ENTRE PROCESOS FLASK) ---
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token_activo.txt")
TOKEN_INICIAL = "TOKEN_A_INICIAL_1234"
ULTIMA_ALERTA_OT = None

def guardar_token(token):
    try:
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            f.write(token.strip())
    except Exception as e:
        print(f"❌ Error al guardar token en archivo: {e}")

def leer_token():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
        except Exception:
            pass
    return TOKEN_INICIAL

# Crear archivo inicial si no existe
if not os.path.exists(TOKEN_FILE):
    guardar_token(TOKEN_INICIAL)

# --- OYENTE MQTT EN SEGUNDO PLANO ---
def iniciar_oyente_mqtt():
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print("[OK] [WEB BACKEND] Escuchador MQTT conectado a la Raspberry Pi")
            client.subscribe("ctf/plant2/token_update")
        else:
            print(f"[WARN] [WEB BACKEND] Fallo al conectar MQTT (Codigo {rc})")

    def on_message(client, userdata, msg):
        global ULTIMA_ALERTA_OT
        payload = msg.payload.decode("utf-8").strip()

        if payload.startswith("NEW:"):
            nuevo_tok = payload.replace("NEW:", "").strip()
            guardar_token(nuevo_tok)
            ULTIMA_ALERTA_OT = None  # Limpiar alertas
            print(f"[INFO] [WEB BACKEND] Token de Planta 2 rotado y guardado: {nuevo_tok}")
        elif payload.startswith("ALERT:"):
            ULTIMA_ALERTA_OT = payload.replace("ALERT:", "").strip()
            print(f"[ALERT] [WEB BACKEND] Alerta OT recibida: {ULTIMA_ALERTA_OT}")
        else:
            guardar_token(payload)

    # Evitar arrancar doble hilo por el recargador de Werkzeug
    client_id = f"Flask_Web_Listener_{uuid.uuid4().hex[:6]}"
    try:
        client = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION1, client_id=client_id)
    except AttributeError:
        client = mqtt_client.Client(client_id=client_id)

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect("10.10.20.67", 1883, 60)
        client.loop_forever()
    except Exception as e:
        print(f"[ERROR] Error conectando oyente MQTT de la Web: {e}")

# Iniciar hilo sólo en el proceso activo de Werkzeug
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or os.environ.get("WERKZEUG_RUN_MAIN") is None:
    threading.Thread(target=iniciar_oyente_mqtt, daemon=True).start()

# --- RUTAS DE MENSAJES DE LA WEB ---

@gas_bp.route('/messages', methods=['GET'])
def get_messages():
    """Devuelve los mensajes de la BD e inyecta dinámicamente el token leído desde el archivo."""
    try:
        token_actual = leer_token()
        messages = Message.query.all()
        msg_list = [{"id": m.id, "sender": m.sender, "content": m.content} for m in messages]

        # 1. Inyectar alerta si existió un intento de Replay Attack
        if ULTIMA_ALERTA_OT:
            alert_msg = {
                "id": "sys-ot-alert",
                "sender": "SISTEMA SCADA OT",
                "content": f"🚨 <span style='color: #dc3545; font-weight: bold;'>[ALERTA DE SEGURIDAD]</span> {ULTIMA_ALERTA_OT}"
            }
            msg_list.insert(0, alert_msg)

        # 2. Inyectar el token efímero activo
        system_msg = {
            "id": "sys-ot-token",
            "sender": "SISTEMA SCADA OT",
            "content": f"⚠️ <strong>[AUTENTICACIÓN REQUERIDA]</strong> Token efímero de canal MQTT activo: <code style='color: #d63384; font-weight: bold; background-color: #f8f9fa; padding: 2px 6px; border-radius: 4px;'>{token_actual}</code> (Se descartará tras su primer uso)."
        }
        msg_list.insert(0, system_msg)

        return jsonify(msg_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@gas_bp.route('/messages', methods=['POST'])
def save_message():
    try:
        data = request.get_json() or {}
        sender = data.get('sender', 'Anónimo')
        content = data.get('content', '')

        if not content:
            return jsonify({'error': 'El contenido del mensaje no puede estar vacío'}), 400

        new_msg = Message(sender=sender, content=content)
        db.session.add(new_msg)
        db.session.commit()
        return jsonify({"message": "Mensaje enviado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500