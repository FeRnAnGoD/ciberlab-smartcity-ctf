import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import Sidebar from '../components/Sidebar';

export default function Settings() {
  const [user, setUser] = useState({ username: '', role: '' });
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Cargar credenciales del usuario logueado
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ username: decoded.username, role: decoded.role });
      } catch (e) {
        console.error("Error al decodificar token", e);
      }
    }

    // Verificar si el modo oscuro estaba previamente activado
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
    }
  }, []);

  // Función para conmutar el Modo Oscuro
  const handleThemeToggle = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);

    if (nextMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="d-flex">
      <Sidebar userRole={user.role} userName={user.username} />

      <div className="p-4 flex-grow-1 bg-light vh-100 overflow-auto">
        <div className="mb-4">
          <h2 className="fw-bold text-dark m-0">Configuración del Sistema</h2>
          <small className="text-muted">Ajustes generales e interfaz de usuario</small>
        </div>

        {/* MÓDULO DE APARIENCIA (MODO OSCURO) */}
        <div className="card scada-card p-4 mb-4" style={{ maxWidth: '700px' }}>
          <h5 className="fw-bold mb-3">Apariencia y Visualización</h5>
          
          <div className="d-flex align-items-center justify-content-between p-3 border rounded bg-body">
            <div>
              <h6 className="fw-bold m-0">Modo Oscuro (Dark Theme)</h6>
              <small className="text-muted">
                Optimiza la visualización para entornos industriales de baja iluminación o trabajo nocturno.
              </small>
            </div>
            
            <div className="form-check form-switch fs-4 m-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="darkModeSwitch"
                checked={darkMode}
                onChange={handleThemeToggle}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* INFORMACIÓN DEL PERFIL */}
        <div className="card scada-card p-4" style={{ maxWidth: '700px' }}>
          <h5 className="fw-bold mb-3">Información de Sesión</h5>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="text-muted small">Usuario Conectado</label>
              <div className="fw-bold">{user.username || 'Cargando...'}</div>
            </div>
            <div className="col-sm-6">
              <label className="text-muted small">Rol de Acceso</label>
              <div>
                <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>
                  {user.role ? user.role.toUpperCase() : 'USER'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
