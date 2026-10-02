FROM debian:bookworm

# Actualizar sistema e instalar el servidor SSH
RUN apt-get update && apt-get install -y openssh-server sudo && rm -rf /var/lib/apt/lists/*
RUN mkdir /var/run/sshd

# Crear el usuario tech_admin
RUN useradd -rm -d /home/tech_admin -s /bin/bash -g root -G sudo -u 1000 tech_admin

# Asignar una contraseña por defecto (tu app.py probablemente la cambie dinámicamente)
RUN echo 'tech_admin:gas_plant_123' | chpasswd

# Configurar SSH para permitir el inicio de sesión con contraseña
RUN sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
RUN sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Exponer el puerto estándar de SSH
EXPOSE 22

# Comando para mantener la máquina encendida escuchando conexiones
CMD ["/usr/sbin/sshd", "-D"]