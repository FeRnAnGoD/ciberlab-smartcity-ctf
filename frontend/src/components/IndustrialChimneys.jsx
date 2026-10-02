import React from 'react';

export default function IndustrialChimneys({ isOperating = true }) {
  return (
    <div className="chimneys-wrapper">
      <svg width="340" height="170" viewBox="0 0 340 170" className="chimneys-svg">
        <defs>
          {/* FILTRO DE FLUIDO Y TURBULENCIA GASEOSA */}
          <filter id="smoke-fluid-filter" x="-50%" y="-150%" width="200%" height="300%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="2" />
          </filter>

          {/* GRADIENTE DE HUMO MÁS BLANCO Y DENSO */}
          <radialGradient id="smoke-plume-grad">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#f1f5f9" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#cbd5e1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
          </radialGradient>

          {/* Gradientes metálicos de la estructura */}
          <linearGradient id="chimney-body" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="35%" stopColor="#475569" />
            <stop offset="70%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="chimney-rim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        {/* --- CHIMENEA IZQUIERDA --- */}
        <g transform="translate(80, 25)">
          {/* 5 Estelas de humo en emisión constante y densa */}
          {isOperating && (
            <g className="smoke-group" filter="url(#smoke-fluid-filter)">
              <path className="smoke-plume smoke-1" d="M 22 75 C 16 64, 24 50, 30 48 C 38 46, 44 60, 38 72 C 32 78, 25 78, 22 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-2" d="M 20 75 C 14 62, 26 48, 30 45 C 39 42, 45 58, 39 70 C 31 76, 24 77, 20 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-3" d="M 23 75 C 18 65, 23 52, 30 50 C 37 48, 43 62, 37 74 C 33 77, 26 77, 23 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-4" d="M 21 75 C 15 63, 25 49, 30 46 C 38 43, 44 59, 38 71 C 32 77, 25 78, 21 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-5" d="M 22 75 C 17 64, 23 51, 30 49 C 37 47, 43 61, 37 73 C 33 77, 26 77, 22 75 Z" fill="url(#smoke-plume-grad)" />
            </g>
          )}

          {/* Cuerpo Cilíndrico de la Torre */}
          <path d="M 12 75 L 17 140 L 43 140 L 48 75 Z" fill="url(#chimney-body)" stroke="#0f172a" strokeWidth="1" />
          <rect x="13.5" y="85" width="33" height="8" fill="#ef4444" opacity="0.9" />
          <rect x="14.8" y="103" width="30.4" height="8" fill="#f8fafc" opacity="0.9" />
          <rect x="16" y="121" width="28" height="8" fill="#ef4444" opacity="0.9" />

          {/* Boca superior */}
          <ellipse cx="30" cy="75" rx="18" ry="4" fill="url(#chimney-rim)" stroke="#1e293b" strokeWidth="1" />
          <ellipse cx="30" cy="75" rx="13" ry="2.5" fill="#020617" />
        </g>

        {/* --- CHIMENEA DERECHA --- */}
        <g transform="translate(180, 25)">
          {/* 5 Estelas de humo en emisión constante y densa */}
          {isOperating && (
            <g className="smoke-group" filter="url(#smoke-fluid-filter)">
              <path className="smoke-plume smoke-6" d="M 22 75 C 16 64, 24 50, 30 48 C 38 46, 44 60, 38 72 C 32 78, 25 78, 22 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-7" d="M 20 75 C 14 62, 26 48, 30 45 C 39 42, 45 58, 39 70 C 31 76, 24 77, 20 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-8" d="M 23 75 C 18 65, 23 52, 30 50 C 37 48, 43 62, 37 74 C 33 77, 26 77, 23 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-9" d="M 21 75 C 15 63, 25 49, 30 46 C 38 43, 44 59, 38 71 C 32 77, 25 78, 21 75 Z" fill="url(#smoke-plume-grad)" />
              <path className="smoke-plume smoke-10" d="M 22 75 C 17 64, 23 51, 30 49 C 37 47, 43 61, 37 73 C 33 77, 26 77, 22 75 Z" fill="url(#smoke-plume-grad)" />
            </g>
          )}

          {/* Cuerpo Cilíndrico de la Torre */}
          <path d="M 12 75 L 17 140 L 43 140 L 48 75 Z" fill="url(#chimney-body)" stroke="#0f172a" strokeWidth="1" />
          <rect x="13.5" y="85" width="33" height="8" fill="#ef4444" opacity="0.9" />
          <rect x="14.8" y="103" width="30.4" height="8" fill="#f8fafc" opacity="0.9" />
          <rect x="16" y="121" width="28" height="8" fill="#ef4444" opacity="0.9" />

          {/* Boca superior */}
          <ellipse cx="30" cy="75" rx="18" ry="4" fill="url(#chimney-rim)" stroke="#1e293b" strokeWidth="1" />
          <ellipse cx="30" cy="75" rx="13" ry="2.5" fill="#020617" />
        </g>

        {/* Base de la Plataforma */}
        <rect x="50" y="160" width="240" height="8" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
      </svg>
    </div>
  );
}