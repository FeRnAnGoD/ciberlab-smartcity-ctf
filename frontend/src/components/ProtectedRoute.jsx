import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Componente que protege rutas privadas.
 * Si no hay token en localStorage, redirige al login.
 * Si hay token, renderiza el componente hijo normalmente.
 */
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  if (!token) {
    // Sin token → redirigir al login, preservando la ruta destino
    return <Navigate to="/login" replace />;
  }

  return children;
}
