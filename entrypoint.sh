#!/bin/bash
set -e

echo "[+] Inicializando base de datos para la instancia..."
cd /app/backend
python seed_admin.py

echo "[+] Iniciando Nginx..."
service nginx start

echo "[+] Iniciando Backend Flask con Gunicorn en puerto 5000..."
exec gunicorn --bind 127.0.0.1:5000 "run:app" --workers 2 --threads 2
