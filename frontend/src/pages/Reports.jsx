import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import Sidebar from '../components/Sidebar';

export default function Reports() {
  const [user, setUser] = useState({ username: '', role: '' });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ username: decoded.username, role: decoded.role });
      } catch (e) {
        console.error('Error decodificando token', e);
      }
    }
    fetchReports(token);
  }, []);

  const fetchReports = async (token) => {
    setLoading(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Intentar primero con proxy relativo, luego con URL directa
    const urls = ['/api/gas/reports/list', '/api/gas/reports/list'];
    
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
          setLoading(false);
          return;
        }
      } catch (err) {
        // Seguir intentando con la siguiente URL
      }
    }
    setLoading(false);
  };

  const handleDownload = async (filename) => {
    setDownloadError('');
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const urls = [
      `/api/gas/reports/download?file=${encodeURIComponent(filename)}`,
      `/api/gas/reports/download?file=${encodeURIComponent(filename)}`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const blob = await res.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
          return;
        }
      } catch (err) {
        // Seguir intentando
      }
    }
    setDownloadError('Error al descargar el archivo desde el servidor.');
  };

  const getFileIcon = (name) => {
    if (name.endsWith('.txt')) return '📄';
    if (name.endsWith('.pdf')) return '📕';
    if (name.endsWith('.py'))  return '🐍';
    if (name.endsWith('.json')) return '🗂️';
    return '📎';
  };

  const getFileBadge = (name) => {
    if (name.includes('auditoria'))
      return <span className="badge bg-danger ms-2">Auditoría</span>;
    if (name.includes('manual'))
      return <span className="badge bg-primary ms-2">Manual</span>;
    return <span className="badge bg-secondary ms-2">Documento</span>;
  };

  return (
    <div className="d-flex">
      <Sidebar userRole={user.role} userName={user.username} />
      <div className="p-4 flex-grow-1 bg-light">

        {/* CABECERA */}
        <div className="d-flex align-items-center gap-2 mb-1">
          <h2 className="mb-0">📁 Reportes e Informes OT</h2>
        </div>
        <p className="text-muted small mb-4">
          Documentación técnica y registros de auditoría de la Planta de Gas — Cuadrante 2
        </p>

        {/* AVISO DE ERROR */}
        {downloadError && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error:</strong> {downloadError}
            <button
              type="button"
              className="btn-close"
              onClick={() => setDownloadError('')}
            />
          </div>
        )}

        {/* TABLA DE REPORTES DISPONIBLES */}
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
            <span className="fw-bold">📂 Archivos Disponibles</span>
            <small className="text-muted">
              {reports.length} archivo(s) encontrado(s)
            </small>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm me-2" role="status" />
                Cargando archivos...
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-4 text-muted">
                No hay archivos disponibles.
              </div>
            ) : (
              <table className="table table-hover mb-0">
                <thead className="table-secondary">
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Nombre del Archivo</th>
                    <th>Tipo</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((name) => (
                    <tr key={name}>
                      <td className="text-center fs-5">{getFileIcon(name)}</td>
                      <td>
                        <span className="fw-semibold">{name}</span>
                        {getFileBadge(name)}
                      </td>
                      <td>
                        <small className="text-muted">
                          {name.split('.').pop().toUpperCase()}
                        </small>
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleDownload(name)}
                        >
                          ⬇ Descargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* HISTORIAL DE EVENTOS (tabla original conservada) */}
        <div className="card p-3 shadow-sm">
          <h5>📋 Historial de Eventos Recientes</h5>
          <table className="table table-striped mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>19/08/2026 10:15</td>
                <td>Apertura de Válvula Principal</td>
                <td><span className="badge bg-success">Exitoso</span></td>
              </tr>
              <tr>
                <td>19/08/2026 08:30</td>
                <td>Calibración de Sensor Presión PSI</td>
                <td><span className="badge bg-info">Completado</span></td>
              </tr>
              <tr>
                <td>18/08/2026 22:47</td>
                <td>Activación protocolo de monitoreo nocturno</td>
                <td><span className="badge bg-success">Exitoso</span></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
