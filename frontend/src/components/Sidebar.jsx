import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar({ userRole, userName }) {
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const initial = userName ? userName.charAt(0).toUpperCase() : 'U';
  const isAdmin = userRole && userRole.toString().toLowerCase() === 'admin';

  const handleOpenMaintenance = async () => {
    if (!isAdmin || isLaunching) return;
    setIsLaunching(true);
    setStatusFeedback('Conectando...');

    // Abrir una ventana temporal con interfaz de carga SCADA mientras conectamos con el puerto 8080
    const w = 1150;
    const h = 850;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    const popup = window.open(
      'about:blank',
      'SCADA_Maintenance_Console',
      `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );

    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Inicializando Mantenimiento OT...</title>
          <style>
            body {
              background-color: #05080c;
              color: #00e5ff;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .spinner {
              width: 50px;
              height: 50px;
              border: 4px solid rgba(0, 229, 255, 0.2);
              border-top-color: #00e5ff;
              border-radius: 50%;
              animation: spin 1s infinite linear;
              margin-bottom: 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h2 style="letter-spacing: 1px;">INICIALIZANDO ESTACIÓN DE MANTENIMIENTO OT...</h2>
          <p style="color: #94a3b8;">Conectando con la consola de diagnóstico en puerto 8080...</p>
        </body>
        </html>
      `);
    }

    // 1. Verificar si el puerto 8080 ya está activo (ej: lanzado previamente o por terminal)
    let isPortActive = false;
    try {
      await fetch('http://localhost:8080/', { mode: 'no-cors' });
      isPortActive = true;
    } catch (e) {
      isPortActive = false;
    }

    if (isPortActive) {
      if (popup && !popup.closed) {
        popup.location.href = 'http://localhost:8080';
        popup.focus();
      } else {
        window.open('http://localhost:8080', '_blank');
      }
      setStatusFeedback('Consola activa');
      setIsLaunching(false);
      setTimeout(() => setStatusFeedback(''), 4000);
      return;
    }

    // 2. Si no está activo aún, solicitar al backend que ejecute app.py
    try {
      const token = localStorage.getItem('token');
      const endpoints = [
        '/api/gas/maintenance/launch',
        'http://127.0.0.1:5000/api/gas/maintenance/launch',
        'http://localhost:5000/api/gas/maintenance/launch'
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              await res.json();
              break;
            }
          }
        } catch (e) {
          // Intentar el siguiente endpoint
        }
      }

      // 3. Esperar a que el puerto 8080 responda tras el arranque
      for (let i = 0; i < 15; i++) {
        try {
          await fetch('http://localhost:8080/', { mode: 'no-cors' });
          isPortActive = true;
          break;
        } catch (e) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    } catch (err) {
      // Ignorar para redirigir de todas formas a http://localhost:8080
    }

    // 4. Redirigir la ventana a la consola en el puerto 8080
    if (popup && !popup.closed) {
      popup.location.href = 'http://localhost:8080';
      popup.focus();
    } else {
      window.open('http://localhost:8080', '_blank');
    }

    setStatusFeedback('Consola activa');
    setIsLaunching(false);
    setTimeout(() => setStatusFeedback(''), 4000);
  };

  return (
    <div className="d-flex flex-column vh-100 p-3 text-white bg-dark" style={{ width: '250px' }}>
      <h4 className="text-info text-center fw-bold mb-4">Ciberlab UC OT</h4>
      
      <div className="text-center mb-4">
        <div className="rounded-circle bg-primary d-inline-flex align-items-center justify-content-center text-white fw-bold mb-2" style={{ width: '60px', height: '60px', fontSize: '24px' }}>
          {initial}
        </div>
        <div className="fw-bold">{userName || 'Usuario'}</div>
        <small className={`fw-bold d-block ${isAdmin ? 'text-warning' : 'text-info'}`}>
          {isAdmin ? 'Administrador' : 'Ingeniero de Planta'}
        </small>
      </div>

      <ul className="nav nav-pills flex-column mb-auto">
        <li className="nav-item mb-2">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : 'text-white'}`}>
            Panel SCADA
          </NavLink>
        </li>
        <li className="nav-item mb-2">
          <NavLink to="/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : 'text-white'}`}>
            Mensajes
          </NavLink>
        </li>
        <li className="nav-item mb-2">
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : 'text-white'}`}>
            Reportes e Informes
          </NavLink>
        </li>
        <li className="nav-item mb-2">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : 'text-white'}`}>
            Configuración
          </NavLink>
        </li>

        {/* BOTÓN MANTENIMIENTO: Solo visible y operable para administradores */}
        {isAdmin && (
          <li className="nav-item mt-3 pt-3 border-top border-secondary">
            <button
              onClick={handleOpenMaintenance}
              disabled={isLaunching}
              className="btn btn-warning w-100 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm py-2"
              style={{ backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#000000', fontWeight: '800', letterSpacing: '0.5px' }}
              title="Iniciar terminal de mantenimiento de planta (Linux / Docker)"
            >
              <span style={{ color: '#000000', fontWeight: '800' }}>🛠️ Mantenimiento</span>
              {isLaunching && <span className="spinner-border spinner-border-sm text-dark ms-1" role="status" style={{ color: '#000000' }} />}
            </button>
            {statusFeedback && (
              <small className="text-warning text-center d-block mt-1 fw-bold" style={{ fontSize: '11px' }}>
                {statusFeedback}
              </small>
            )}
          </li>
        )}
      </ul>

      <button onClick={handleLogout} className="btn btn-outline-danger w-100 mt-auto">
        Cerrar Sesión
      </button>
    </div>
  );
}