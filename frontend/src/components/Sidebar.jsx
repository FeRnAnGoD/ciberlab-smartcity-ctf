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

  const handleOpenMaintenance = () => {
    if (!isAdmin || isLaunching) return;

    const w = 1150;
    const h = 850;
    const left = (window.screen.width - w) / 2;
    const top  = (window.screen.height - h) / 2;

    window.open(
      '/api/maintenance/portal',
      'SCADA_Maintenance_Console',
      `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );
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