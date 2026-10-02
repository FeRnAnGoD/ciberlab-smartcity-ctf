import React from 'react';

export default function LiquidTank({ level = 75, capacity = 12000 }) {
  const currentLevel = Math.min(100, Math.max(0, level));
  // Control de elevación del fluido dentro del tanque (0% en Y=200, 100% en Y=20)
  const waveY = 200 - (currentLevel * 1.8);

  return (
    <div className="liquid-tank-wrapper">
      <svg width="150" height="230" viewBox="0 0 150 230" className="liquid-tank-svg">
        <defs>
          {/* Máscara cilíndrica con bordes suavizados */}
          <clipPath id="tank-clip">
            <rect x="15" y="15" width="120" height="200" rx="25" ry="25" />
          </clipPath>

          {/* Gradiente Neón para Ola Principal */}
          <linearGradient id="liquid-front-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d2ff" />
            <stop offset="100%" stopColor="#0066ff" />
          </linearGradient>

          {/* Gradiente Translúcido para Ola Secundaria de Fondo */}
          <linearGradient id="liquid-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#38ef7d" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Estructura externa e interna del tanque */}
        <rect x="15" y="15" width="120" height="200" rx="25" ry="25" fill="#0d1527" stroke="#2c3e50" strokeWidth="4" />

        {/* Marcas de graduación del nivel */}
        <g stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3,3">
          <line x1="20" y1="65" x2="40" y2="65" />
          <text x="45" y="68" fill="#ffffff" fillOpacity="0.3" fontSize="8">75%</text>

          <line x1="20" y1="115" x2="40" y2="115" />
          <text x="45" y="118" fill="#ffffff" fillOpacity="0.3" fontSize="8">50%</text>

          <line x1="20" y1="165" x2="40" y2="165" />
          <text x="45" y="168" fill="#ffffff" fillOpacity="0.3" fontSize="8">25%</text>
        </g>

        {/* Contenido con máscara líquida */}
        <g clipPath="url(#tank-clip)">
          {/* Grupo dinámico que asciende/desciende según el nivel */}
          <g style={{ transform: `translateY(${waveY}px)`, transition: 'transform 1s ease-in-out' }}>
            
            {/* OLA TRASERA: Curva sinusoidal continua con período de 160px */}
            <path
              className="seamless-wave wave-back"
              fill="url(#liquid-back-grad)"
              d="M 0 0 C 20 -10, 60 -10, 80 0 C 100 10, 140 10, 160 0 C 180 -10, 220 -10, 240 0 C 260 10, 300 10, 320 0 C 340 -10, 380 -10, 400 0 C 420 10, 460 10, 480 0 V 220 H 0 Z"
            />

            {/* OLA FRONTAL: Desfasada para crear volumen 3D y fluidez */}
            <path
              className="seamless-wave wave-front"
              fill="url(#liquid-front-grad)"
              d="M 0 0 C 20 12, 60 12, 80 0 C 100 -12, 140 -12, 160 0 C 180 12, 220 12, 240 0 C 260 -12, 300 -12, 320 0 C 340 12, 380 12, 400 0 C 420 -12, 460 -12, 480 0 V 220 H 0 Z"
            />
          </g>

          {/* Burbujas flotantes continuas */}
          <circle className="bubble bubble-1" cx="35" cy="190" r="3" fill="#ffffff" opacity="0.6" />
          <circle className="bubble bubble-2" cx="70" cy="195" r="4" fill="#ffffff" opacity="0.5" />
          <circle className="bubble bubble-3" cx="100" cy="185" r="2.5" fill="#ffffff" opacity="0.7" />
        </g>

        {/* Reflejo de cristal frontal */}
        <rect x="20" y="20" width="8" height="190" rx="4" fill="#ffffff" opacity="0.1" />
      </svg>

      {/* Indicador numérico */}
      <div className="text-center mt-2">
        <div className="fs-4 fw-bold text-primary">{currentLevel.toFixed(1)}%</div>
        <small className="text-muted d-block">
          {((currentLevel / 100) * capacity).toLocaleString('es-CL', { maximumFractionDigits: 0 })} / {capacity.toLocaleString('es-CL')} L
        </small>
      </div>
    </div>
  );
}