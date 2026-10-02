# ==========================================
# ETAPA 1: Compilar Frontend React + Vite
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# ETAPA 2: Entorno de Producción (Python + Nginx)
# ==========================================
FROM python:3.11-slim

# Instalar Nginx y dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Python
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Si vas a usar Raspberry Pi GPIO directamente desde el script, descomenta:
# RUN pip install --no-cache-dir RPi.GPIO gpiozero

# Copiar el backend
COPY backend/ /app/backend/

# Copiar el build del frontend a Nginx
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copiar el launcher del portal de mantenimiento
COPY ctf-planta-gas/launcher /app/ctf-planta-gas/launcher

# Copiar archivos de configuración
COPY nginx.conf /etc/nginx/sites-available/default
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Crear la base de datos de forma predeterminada al inicializar
ENV DATABASE_URL="sqlite:////app/backend/planta_gas.db"

EXPOSE 80

CMD ["/app/entrypoint.sh"]
