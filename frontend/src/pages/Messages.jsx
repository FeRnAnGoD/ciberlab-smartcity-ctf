import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import Sidebar from '../components/Sidebar';

export default function Messages() {
  const [user, setUser] = useState({ username: '', role: '' });
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');

  const loadMessages = async () => {
    try {
      // ?t=Date.now() y cache: 'no-store' evitan que el navegador guarde la respuesta en caché
      const res = await fetch(`/api/gas/messages?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error al cargar mensajes:", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ username: decoded.username, role: decoded.role });
      } catch (e) {
        console.error("Token inválido:", e);
      }
    }

    // Cargar mensajes inmediatamente al montar
    loadMessages();

    // Polling automático cada 3 segundos para refrescar el token en vivo si es rotado
    const interval = setInterval(() => {
      loadMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/gas/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: user.username || 'Anónimo',
          content: content
        })
      });

      if (res.ok) {
        setContent('');
        loadMessages();
      }
    } catch (err) {
      console.error("Error al enviar el mensaje:", err);
    }
  };

  return (
    <div className="d-flex">
      <Sidebar userRole={user.role} userName={user.username} />
      <div className="p-4 flex-grow-1 bg-light">
        <h2>Centro de Mensajes</h2>

        <div className="card p-3 mt-3 shadow-sm mb-4">
          <h5 className="card-title">Nuevo Comunicado</h5>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <textarea 
                className="form-control"
                rows="3"
                placeholder="Escriba un mensaje para la planta..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Enviar Mensaje
            </button>
          </form>
        </div>

        <div className="card p-3 shadow-sm">
          <p className="text-muted">Canal de comunicación interno de la planta.</p>
          <ul className="list-group">
            {messages.length === 0 ? (
              <li className="list-group-item text-muted">No hay mensajes guardados.</li>
            ) : (
              messages.map((msg) => (
                <li 
                  key={msg.id} 
                  className={`list-group-item mb-2 rounded ${
                    msg.id === 'sys-ot-alert' 
                      ? 'list-group-item-danger border-danger' 
                      : msg.sender === 'SISTEMA SCADA OT' 
                      ? 'list-group-item-warning border-warning' 
                      : ''
                  }`}
                >
                  <strong>[{msg.sender}]:</strong>
                  <div 
                    className="mt-1"
                    dangerouslySetInnerHTML={{ __html: msg.content }} 
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
