import React, { useState, useEffect, useMemo, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { Line, Doughnut } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import Sidebar from '../components/Sidebar';
import LiquidTank from '../components/LiquidTank';
import IndustrialChimneys from '../components/IndustrialChimneys';
import './ControlPanel.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

// PLUGIN PARA DIBUJAR LA ZONA PROHIBIDA DE AUTOIGNICIÓN (400°C - 580°C) EN EL GRÁFICO DEDICADO DE TEMPERATURA
const prohibitedZonePlugin = {
  id: 'prohibitedZone',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const y = scales.y;
    if (!y || !chartArea) return;

    const topPx = y.getPixelForValue(580);
    const bottomPx = y.getPixelForValue(400);

    if (isNaN(topPx) || isNaN(bottomPx)) return;

    const actualTop = Math.min(topPx, bottomPx);
    const actualBottom = Math.max(topPx, bottomPx);
    const height = Math.max(1, actualBottom - actualTop);

    ctx.save();
    
    // Franja traslúcida de advertencia
    ctx.fillStyle = 'rgba(243, 156, 18, 0.22)';
    ctx.fillRect(chartArea.left, actualTop, chartArea.width, height);

    // Texto descriptivo en el gráfico
    ctx.fillStyle = '#d35400';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('⚠️ ZONA PROHIBIDA DE AUTOIGNICIÓN (400 °C - 580 °C)', chartArea.left + 6, actualTop + 12);

    // Línea inferior segmentada
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1.5;
    ctx.moveTo(chartArea.left, actualBottom);
    ctx.lineTo(chartArea.right, actualBottom);
    ctx.stroke();

    ctx.restore();
  }
};

const generateInitial5MinHistory = () => {
  const labels = [];
  const pValues = [];
  const tValues = [];
  
  const start = new Date();
  start.setHours(7, 0, 0, 0);
  const now = new Date();

  if (now < start) {
    start.setHours(0, 0, 0, 0);
  }

  let curr = new Date(start);
  let seedP = 430;
  let seedT = 22.0;

  const currentBucketMin = Math.floor(now.getMinutes() / 5) * 5;
  const lastBucketDate = new Date(now);
  lastBucketDate.setMinutes(currentBucketMin, 0, 0);

  while (curr <= lastBucketDate) {
    const hh = String(curr.getHours()).padStart(2, '0');
    const mm = String(curr.getMinutes()).padStart(2, '0');
    labels.push(`${hh}:${mm}`);

    seedP = Math.min(510, Math.max(400, seedP + (Math.random() * 8 - 4)));
    seedT = Math.min(28, Math.max(18, seedT + (Math.random() * 0.6 - 0.3)));

    pValues.push(Math.round(seedP));
    tValues.push(parseFloat(seedT.toFixed(1)));

    curr.setMinutes(curr.getMinutes() + 5);
  }

  return { labels, pValues, tValues };
};

export default function ControlPanel() {
  const [user, setUser] = useState({ username: '', role: '' });
  
  // CONTROL DE PESTAÑAS PRINCIPALES
  const [activeTab, setActiveTab] = useState('gas');

  // ESTADOS DE LA PLANTA DE GAS
  const [systemPower, setSystemPower] = useState(true);
  const [tankLevel, setTankLevel] = useState(78);
  const [pressure, setPressure] = useState(450);
  const [temperature, setTemperature] = useState(24.5);
  const [gasFlow, setGasFlow] = useState(1250);
  
  const [leakDetected, setLeakDetected] = useState(true);
  const [leakSector, setLeakSector] = useState('Sector C - Tubería Distribución Sur (Válvula B-12)');

  const [equipments, setEquipments] = useState({
    compresor: true,
    valvulaEntrada: true,
    refrigeracion: true
  });

  // GESTIÓN DE NOTIFICACIONES SCADA CON AUTODESVANECIMIENTO Y CIERRE MANUAL
  const [statusMsg, setStatusMsg] = useState('');
  const [isStatusFading, setIsStatusFading] = useState(false);
  const statusTimerRef = useRef(null);
  const wasElevatedTempRef = useRef(false);

  // ESTADOS DE ALERTAS DE TEMPERATURA
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [dismissedCritical, setDismissedCritical] = useState(false);

  const [timeFilter, setTimeFilter] = useState('today');
  const [selectedYear, setSelectedYear] = useState(1952);

  const [history5Min, setHistory5Min] = useState(generateInitial5MinHistory);
  const [liveSecondsBuffer, setLiveSecondsBuffer] = useState([]);

  // ESTADOS DE PANEL LUCES RGB
  const [rgbPower, setRgbPower] = useState(true);
  const [rgbInputText, setRgbInputText] = useState('0, 212, 255');
  const [activeColor, setActiveColor] = useState({ r: 0, g: 212, b: 255 });
  const [rgbError, setRgbError] = useState('');

  // ESTADO Y PRIVILEGIOS DE ADMINISTRACIÓN
  const isAdmin = Boolean(user.role && user.role.toLowerCase() === 'admin');

  const pressureRef = useRef(pressure);
  const temperatureRef = useRef(temperature);
  useEffect(() => {
    pressureRef.current = pressure;
    temperatureRef.current = temperature;
  }, [pressure, temperature]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ username: decoded.username, role: decoded.role });
      } catch (e) {
        console.error("Error decodificando token", e);
      }
    }
  }, []);

  // FUNCIÓN PARA MOSTRAR MENSAJE SCADA CON AUTODESVANECIMIENTO
  const showScadaMessage = (msg, autoDismiss = false) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    setStatusMsg(msg);
    setIsStatusFading(false);

    if (autoDismiss) {
      statusTimerRef.current = setTimeout(() => {
        setIsStatusFading(true);
        statusTimerRef.current = setTimeout(() => {
          setStatusMsg('');
          setIsStatusFading(false);
        }, 1200);
      }, 10000);
    }
  };

  const handleCloseStatusMsg = () => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    setStatusMsg('');
    setIsStatusFading(false);
  };

  // MONITOREA EL RETORNO DE TEMPERATURA A NIVELES ÓPTIMOS
  useEffect(() => {
    if (temperature > 30) {
      wasElevatedTempRef.current = true;
    } else if (temperature <= 30 && wasElevatedTempRef.current && equipments.refrigeracion) {
      wasElevatedTempRef.current = false;
      showScadaMessage('✅ Parámetros SCADA ajustados correctamente. Temperatura estabilizada en rango óptimo (-15 °C a 30 °C).', true);
    }
  }, [temperature, equipments.refrigeracion]);

  // SIMULACIÓN EN TIEMPO REAL
  useEffect(() => {
    if (!systemPower) return;

    const interval = setInterval(() => {
      setTankLevel(prev => Math.min(100, Math.max(10, prev + (Math.random() * 1.6 - 0.8))));

      if (equipments.compresor) {
        setPressure(prev => Math.min(520, Math.round(prev + (prev < 460 ? 12 : Math.random() * 4 - 2))));
        setGasFlow(prev => Math.min(1500, Math.round(prev + (prev < 1200 ? 40 : Math.random() * 20 - 10))));
      } else {
        setPressure(prev => Math.max(100, Math.round(prev - 12 + (Math.random() * 2 - 1))));
        setGasFlow(prev => Math.max(0, Math.round(prev - 60 + (Math.random() * 10 - 5))));
      }

      if (equipments.refrigeracion) {
        setTemperature(prev => {
          if (prev > 30) {
            const coolStep = prev > 300 ? 35 : (prev > 100 ? 20 : (prev > 50 ? 8 : 3));
            const nextTemp = Math.max(22.0, prev - coolStep);
            return parseFloat(nextTemp.toFixed(1));
          } else if (prev < -10) {
            return parseFloat((prev + 1.5).toFixed(1));
          } else {
            return parseFloat((prev + (Math.random() * 0.8 - 0.4)).toFixed(1));
          }
        });
      } else {
        setTemperature(prev => {
          const step = prev >= 350 ? 25 : (prev >= 100 ? 35 : 18);
          return parseFloat(Math.min(580, prev + step).toFixed(1));
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [systemPower, equipments.compresor, equipments.refrigeracion]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      
      const timeTag = `${hh}:${mm}:${ss}`;
      const bucketMin = Math.floor(now.getMinutes() / 5) * 5;
      const current5MinLabel = `${hh}:${String(bucketMin).padStart(2, '0')}`;

      const currentP = pressureRef.current;
      const currentT = temperatureRef.current;

      setHistory5Min(prevHistory => {
        const lastLabel = prevHistory.labels[prevHistory.labels.length - 1];
        
        if (lastLabel !== current5MinLabel && !prevHistory.labels.includes(current5MinLabel)) {
          setLiveSecondsBuffer([]);
          return {
            labels: [...prevHistory.labels, current5MinLabel],
            pValues: [...prevHistory.pValues, currentP],
            tValues: [...prevHistory.tValues, currentT]
          };
        }
        return prevHistory;
      });

      setLiveSecondsBuffer(prevSeconds => {
        const updated = [...prevSeconds, { time: timeTag, p: currentP, t: currentT }];
        return updated.length > 300 ? updated.slice(updated.length - 300) : updated;
      });

    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const currentDateObj = new Date();
  const formattedTodayDate = currentDateObj.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const currentYear = currentDateObj.getFullYear();

  // EVALUACIÓN DE CONDICIONES DE ALERTA
  const isHighTemp = !equipments.refrigeracion && temperature > 30;
  const isCriticalAutoignition = temperature >= 400 && temperature <= 580;

  // DESPACHO OPTIMIZADO DE ALERTA DE AUTOIGNICIÓN (>= 400°C) HACIA BACKEND Y RASPBERRY PI
  const prevCriticalRef = useRef(false);
  useEffect(() => {
    if (isCriticalAutoignition !== prevCriticalRef.current) {
      prevCriticalRef.current = isCriticalAutoignition;

      const payload = JSON.stringify({
        active: isCriticalAutoignition,
        activo: isCriticalAutoignition,
        temperature: Math.round(temperature),
        temperatura: Math.round(temperature)
      });

      const headers = { 'Content-Type': 'application/json' };

      fetch('/api/gas/plant2/alert/autoignition', {
        method: 'POST',
        headers,
        body: payload
      }).catch(() => {
        fetch('/api/gas/plant2/alert/autoignition', {
          method: 'POST',
          headers,
          body: payload
        }).catch((err) => {
          console.warn('[SCADA OT] Error despachando alerta de autoignición:', err);
        });
      });
    }
  }, [isCriticalAutoignition, temperature]);

  // CÁLCULO DINÁMICO DE TELEMETRÍA
  const telemetryAndStats = useMemo(() => {
    let labels = [];
    let pData = [];
    let tData = [];
    let periodSubtitle = '';

    if (timeFilter === 'today') {
      const secLabels = liveSecondsBuffer.map(item => item.time);
      const secP = liveSecondsBuffer.map(item => item.p);
      const secT = liveSecondsBuffer.map(item => item.t);

      labels = [...history5Min.labels, ...secLabels];
      pData = [...history5Min.pValues, ...secP];
      tData = [...history5Min.tValues, ...secT];
      periodSubtitle = 'Variación respecto al último bloque de 5m';

      const lastRefP = history5Min.pValues[history5Min.pValues.length - 1] || pressure;
      const lastRefT = history5Min.tValues[history5Min.tValues.length - 1] || temperature;

      const pDiff = pressure - lastRefP;
      const pPct = lastRefP ? ((pDiff / lastRefP) * 100).toFixed(2) : '0.00';

      const tDiff = parseFloat((temperature - lastRefT).toFixed(2));
      const tPct = lastRefT ? ((tDiff / lastRefT) * 100).toFixed(2) : '0.00';

      return {
        labels,
        pData,
        tData,
        subtitle: periodSubtitle,
        stats: { pVal: pressure, pDiff, pPct, tVal: temperature, tDiff, tPct }
      };
    }

    if (timeFilter === 'week') {
      labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      pData = [420, 435, 450, 465, 440, 410, pressure];
      tData = [-5.0, 10.4, 18.1, 24.5, 20.8, 15.0, temperature];
      periodSubtitle = 'Variación acumulada de la Semana (Lunes vs Hoy)';
    } else if (timeFilter === 'month') {
      labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
      pData = [415, 440, 460, pressure];
      tData = [-10.5, 12.8, 22.1, temperature];
      periodSubtitle = 'Variación acumulada del Mes (Inicio de Mes vs Hoy)';
    } else if (timeFilter === 'year') {
      labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      pData = [400, 410, 430, 445, 450, 460, 455, pressure, 440, 435, 420, 410];
      tData = [-12.0, 5.1, 15.5, 23.0, 24.2, 28.0, 24.8, temperature, 21.0, 18.1, 10.8, -2.5];
      periodSubtitle = `Variación acumulada del Año (${currentYear})`;
    } else if (timeFilter === 'custom') {
      labels = ['Q1', 'Q2', 'Q3', 'Q4'];
      const baseMult = (selectedYear - 1952) * 0.2;
      pData = [Math.round(380 + baseMult), Math.round(410 + baseMult), Math.round(430 + baseMult), pressure];
      tData = [-14.0, 10.2, 22.0, temperature];
      periodSubtitle = `Variación desde ${selectedYear} hasta la fecha`;
    }

    const initialP = pData[0];
    const currentP = pData[pData.length - 1];
    const pDiff = currentP - initialP;
    const pPct = initialP ? ((pDiff / initialP) * 100).toFixed(2) : '0.00';

    const initialT = tData[0];
    const currentT = tData[tData.length - 1];
    const tDiff = parseFloat((currentT - initialT).toFixed(2));
    const tPct = initialT ? ((tDiff / initialT) * 100).toFixed(2) : '0.00';

    return {
      labels,
      pData,
      tData,
      subtitle: periodSubtitle,
      stats: { pVal: currentP, pDiff, pPct, tVal: currentT, tDiff, tPct }
    };
  }, [timeFilter, selectedYear, history5Min, liveSecondsBuffer, pressure, temperature, currentYear]);

  // 1. DATA Y OPCIONES DEL GRÁFICO PRINCIPAL COMBINADO (SIN ZONA PROHIBIDA)
  const mainChartData = useMemo(() => {
    const totalLength = telemetryAndStats.labels.length;
    return {
      labels: telemetryAndStats.labels,
      datasets: [
        {
          label: 'Presión (PSI)',
          data: telemetryAndStats.pData,
          borderColor: '#e74c3c',
          backgroundColor: timeFilter === 'today' ? 'rgba(231, 76, 60, 0.12)' : 'rgba(231, 76, 60, 0.2)',
          yAxisID: 'y1',
          tension: timeFilter === 'today' ? 0.1 : 0.35,
          pointRadius: timeFilter === 'today' 
            ? telemetryAndStats.labels.map((_, idx) => (idx === totalLength - 1 ? 5 : 0))
            : 3,
          pointHoverRadius: 4,
          pointBackgroundColor: '#e74c3c'
        },
        {
          label: 'Temperatura (°C)',
          data: telemetryAndStats.tData,
          borderColor: '#f39c12',
          backgroundColor: timeFilter === 'today' ? 'rgba(243, 156, 18, 0.12)' : 'rgba(243, 156, 18, 0.2)',
          yAxisID: 'y2',
          tension: timeFilter === 'today' ? 0.1 : 0.35,
          pointRadius: timeFilter === 'today' 
            ? telemetryAndStats.labels.map((_, idx) => (idx === totalLength - 1 ? 5 : 0))
            : 3,
          pointHoverRadius: 4,
          pointBackgroundColor: '#f39c12'
        }
      ]
    };
  }, [telemetryAndStats, timeFilter]);

  const mainChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: false,
    plugins: { legend: { position: 'top', onClick: () => {} } },
    scales: {
      x: { ticks: { maxTicksLimit: 10, font: { size: 10 } } },
      y1: { type: 'linear', position: 'left', title: { display: true, text: 'Presión (PSI)', font: { size: 11 } } },
      y2: { 
        type: 'linear', 
        position: 'right', 
        grid: { drawOnChartArea: false }, 
        title: { display: true, text: 'Temperatura (°C)', font: { size: 11 } }
      }
    }
  };

  // 2. DATA Y OPCIONES DEL MINIGRÁFICO SOLO PRESIÓN
  const pressureOnlyData = useMemo(() => {
    const totalLength = telemetryAndStats.labels.length;
    return {
      labels: telemetryAndStats.labels,
      datasets: [
        {
          label: 'Presión (PSI)',
          data: telemetryAndStats.pData,
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.15)',
          fill: true,
          tension: timeFilter === 'today' ? 0.1 : 0.35,
          pointRadius: timeFilter === 'today' 
            ? telemetryAndStats.labels.map((_, idx) => (idx === totalLength - 1 ? 4 : 0))
            : 2,
          pointHoverRadius: 4,
          pointBackgroundColor: '#e74c3c'
        }
      ]
    };
  }, [telemetryAndStats, timeFilter]);

  const pressureOnlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxTicksLimit: 6, font: { size: 9 } } },
      y: { type: 'linear', title: { display: true, text: 'PSI', font: { size: 10 } } }
    }
  };

  // 3. DATA Y OPCIONES DEL MINIGRÁFICO SOLO TEMPERATURA (CON ZONA PROHIBIDA)
  const tempOnlyData = useMemo(() => {
    const totalLength = telemetryAndStats.labels.length;
    return {
      labels: telemetryAndStats.labels,
      datasets: [
        {
          label: 'Temperatura (°C)',
          data: telemetryAndStats.tData,
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.15)',
          fill: true,
          tension: timeFilter === 'today' ? 0.1 : 0.35,
          pointRadius: timeFilter === 'today' 
            ? telemetryAndStats.labels.map((_, idx) => (idx === totalLength - 1 ? 4 : 0))
            : 2,
          pointHoverRadius: 4,
          pointBackgroundColor: '#f39c12'
        }
      ]
    };
  }, [telemetryAndStats, timeFilter]);

  const tempOnlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxTicksLimit: 6, font: { size: 9 } } },
      y: { 
        type: 'linear', 
        title: { display: true, text: '°C', font: { size: 10 } },
        suggestedMin: -15,
        suggestedMax: 600
      }
    }
  };

  const chemicalData = {
    labels: ['Metano (CH4)', 'Propano (C3H8)', 'Butano (C4H10)', 'CO2', 'Odorante'],
    datasets: [{
      data: [85, 8, 4, 2, 1],
      backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#e74c3c'],
      hoverOffset: 6
    }]
  };

  const chemicalOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom', onClick: () => {} } }
  };

  const toggleEquipment = (eqKey) => {
    if (user.role !== 'admin') return;
    setEquipments(prev => {
      const newState = !prev[eqKey];
      if (eqKey === 'refrigeracion' && newState) {
        setDismissedWarning(false);
        setDismissedCritical(false);
        showScadaMessage('Equipo "REFRIGERACION" encendido. Iniciando enfriamiento gradual del sistema...', false);
      } else if (eqKey === 'refrigeracion' && !newState) {
        showScadaMessage('⚠️ Equipo "REFRIGERACION" desactivado. Monitoreando elevación de temperatura...', false);
      } else {
        showScadaMessage(`Equipo "${eqKey.toUpperCase()}" ${newState ? 'encendido' : 'apagado'}. Parámetros SCADA ajustándose...`, false);
      }

      // Notificar al backend / Raspberry Pi sobre el estado del chiller
      if (eqKey === 'refrigeracion') {
        const token = localStorage.getItem('token');
        const urls = ['/api/gas/control', '/api/gas/control'];
        for (const url of urls) {
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ accion: `chiller_${newState ? 'encendido' : 'apagado'}`, activo: newState })
          }).catch(() => {});
        }
      }

      return { ...prev, [eqKey]: newState };
    });
  };

  const handleResolveLeak = () => {
    if (user.role !== 'admin') return;
    setLeakDetected(false);
    showScadaMessage('Fuga aislada y bloqueada mediante protocolo de emergencia.', false);
  };

  const handleApplyRgb = () => {
    setRgbError('');
    let raw = rgbInputText.replace(/rgb\(|\)|\[|\]/gi, '').trim();
    let parts = raw.split(/[\s,]+/);

    if (parts.length === 3) {
      let r = parseInt(parts[0], 10);
      let g = parseInt(parts[1], 10);
      let b = parseInt(parts[2], 10);

      if (!isNaN(r) && !isNaN(g) && !isNaN(b) && r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        setActiveColor({ r, g, b });
        return;
      }
    }

    setRgbError('Formato inválido. Ingrese tres números del 0 al 255 separados por comas (Ej: 255, 0, 128)');
  };

  const applyPresetColor = (r, g, b) => {
    setActiveColor({ r, g, b });
    setRgbInputText(`${r}, ${g}, ${b}`);
    setRgbError('');
  };

  const { stats, subtitle } = telemetryAndStats;

  const waveGradientStyle = {
    backgroundImage: `linear-gradient(90deg, 
      rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.15) 0%, 
      rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 1) 25%, 
      rgba(255, 255, 255, 0.95) 50%, 
      rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 1) 75%, 
      rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.15) 100%)`
  };

  const glowShadowColor = `rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.7)`;

  return (
    <div className="d-flex">
      <Sidebar userRole={user.role} userName={user.username} />
      
      <div className={`p-4 flex-grow-1 vh-100 overflow-auto ${isCriticalAutoignition ? 'critical-emergency-bg' : 'bg-light'}`}>
        
        {/* POP-UP DE ADVERTENCIA */}
        {isHighTemp && !isCriticalAutoignition && !dismissedWarning && (
          <div className="temp-warning-popup p-3 d-flex justify-content-between align-items-start shadow">
            <div>
              <div className="fw-bold d-flex align-items-center gap-2 mb-1 warning-title">
                <span>⚠️ ALERTA: SOBRETEMPERATURA EN TUBERÍAS</span>
              </div>
              <small className="d-block warning-body">
                Chiller desactivado. Temperatura actual <strong>({temperature} °C)</strong> supera el rango óptimo de almacenamiento (<strong>-15 °C a 30 °C</strong>).
              </small>
            </div>
            <button 
              onClick={() => setDismissedWarning(true)} 
              className="btn-close ms-2"
              title="Cerrar advertencia"
            />
          </div>
        )}

        {/* ALERTA CRÍTICA DE AUTOIGNICIÓN (400°C - 580°C) */}
        {isCriticalAutoignition && !dismissedCritical && (
          <div className="critical-alert-box d-flex justify-content-between align-items-start">
            <div className="flex-grow-1 me-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fs-3">🚨</span>
                <h4 className="fw-bold m-0 text-warning text-uppercase">
                  ¡ALERTA CRÍTICA: ZONA DE AUTOIGNICIÓN DETECTADA!
                </h4>
              </div>
              <p className="m-0 mb-2 fs-6 text-white fw-semibold">
                La temperatura de la planta alcanzó <strong>{temperature} °C</strong> (Rango Prohibido: 400 °C - 580 °C). Los gases de la mezcla (Metano, Propano, Butano) están en riesgo de combustión espontánea sin chispa.
              </p>
              <div className="p-2 rounded bg-black bg-opacity-40 border border-warning">
                <small className="fw-bold text-warning d-block">
                  ⚡ PROTOCOLO DE EMERGENCIA ACTIVADO: INICIAR EVACUACIÓN INMEDIATA DEL SECTOR Y RECONECTAR SISTEMA DE REFRIGERACIÓN OT.
                </small>
              </div>

              {/* SCRAM CODE — FLAG DEL RETO CTF */}
              <div className="p-2 rounded mt-2 border border-danger text-center"
                   style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <small className="fw-bold text-danger d-block mb-1 text-uppercase">
                  🛑 Sistema SCRAM Activado — Código de Emergencia OT:
                </small>
                <code className="text-warning fw-bold" style={{ fontSize: '1.05rem', letterSpacing: '1px' }}>
                  FLAG&#123;ch1ll3r_0v3rh34t_4ut01gn1t10n&#125;
                </code>
              </div>
            </div>
            <button 
              onClick={() => setDismissedCritical(true)} 
              className="btn-close btn-close-white"
              title="Aceptar y silenciar alerta crítica"
            />
          </div>
        )}

        {/* NAVBAR SUPERIOR */}
        <div className="bg-dark p-2 rounded-3 mb-4 d-flex justify-content-between align-items-center shadow-sm">
          <ul className="nav nav-pills gap-2">
            <li className="nav-item">
              <button 
                className={`nav-link fw-bold px-4 ${activeTab === 'gas' ? 'active bg-primary text-white' : 'text-light'}`}
                onClick={() => setActiveTab('gas')}
              >
                🔥 Planta de Gas
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link fw-bold px-4 ${activeTab === 'rgb' ? 'active bg-primary text-white' : 'text-light'}`}
                onClick={() => setActiveTab('rgb')}
              >
                💡 Luces RGB
              </button>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-3 px-3">
            <div className="text-end">
              <span className="text-white fw-bold d-block" style={{ fontSize: '0.92rem' }}>
                {user.username || 'Usuario'}
              </span>
              <small className={`fw-bold d-block ${isAdmin ? 'text-warning' : 'text-info'}`} style={{ fontSize: '0.78rem' }}>
                {isAdmin ? 'Administrador' : 'Ingeniero de Planta'}
              </small>
            </div>
            <span className="badge bg-secondary">{activeTab === 'gas' ? 'Vista Operacional' : 'Vista Iluminación'}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VISTA 1: PLANTA DE GAS */}
        {/* ========================================================================= */}
        {activeTab === 'gas' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold text-dark m-0">Centro de Monitoreo SCADA - Planta de Gas</h2>
                <small className="text-muted">Vista en tiempo real para Operadores e Ingenieros</small>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-bold">Estado del Sistema:</span>
                <span className={`badge px-3 py-2 fs-6 ${systemPower ? 'bg-success' : 'bg-danger'}`}>
                  {systemPower ? 'SISTEMA ACTIVO' : 'DETENIDO'}
                </span>
                {isAdmin && (
                  <button 
                    onClick={() => setSystemPower(!systemPower)} 
                    className={`btn btn-sm ${systemPower ? 'btn-outline-danger' : 'btn-success'}`}
                  >
                    {systemPower ? 'Apagar Planta' : 'Encender Planta'}
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => {
                      // Abre el portal en nueva pestaña; el token ya está en localStorage
                      window.open('/api/maintenance/portal', '_blank');
                    }}
                    className="btn btn-sm btn-outline-warning"
                    title="Portal de mantenimiento OT (solo admin)"
                  >
                    🔧 Mantenimiento
                  </button>
                )}
              </div>
            </div>

            {/* NOTIFICACIÓN AZUL SCADA */}
            {statusMsg && (
              <div className={`alert alert-info d-flex justify-content-between align-items-center scada-status-alert ${isStatusFading ? 'fading' : ''}`}>
                <span>{statusMsg}</span>
                <button 
                  onClick={handleCloseStatusMsg} 
                  className="btn-close ms-3"
                  title="Cerrar notificación"
                />
              </div>
            )}

            {/* ALERTA DE FUGA */}
            {leakDetected ? (
              <div className="alert alert-danger d-flex justify-content-between align-items-center leak-pulse mb-4">
                <div>
                  <h5 className="fw-bold m-0">⚠️ ¡ALERTA DE FUGA DE GAS DETECTADA!</h5>
                  <div><strong>Ubicación:</strong> {leakSector}</div>
                </div>
                {user.role === 'admin' ? (
                  <button onClick={handleResolveLeak} className="btn btn-light fw-bold text-danger">
                    Aislar y Reparar Fuga
                  </button>
                ) : (
                  <span className="badge bg-dark">Solo Lectura</span>
                )}
              </div>
            ) : (
              <div className="alert alert-success mb-4">
                <strong>✅ Red de Tuberías Estables:</strong> No se detectan fugas de gas.
              </div>
            )}

            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="scada-card p-3 text-center h-100 d-flex flex-column justify-content-between align-items-center">
                  <h6 className="fw-bold text-secondary mb-2">Tanque Principal (GLP)</h6>
                  <LiquidTank level={tankLevel} capacity={12000} />
                </div>
              </div>

              <div className="col-md-5">
                <div className="scada-card p-3 h-100 d-flex flex-column justify-content-between">
                  <h6 className="fw-bold text-secondary mb-3">Parámetros Críticos en Línea</h6>
                  
                  <div className="row text-center g-2">
                    <div className="col-4">
                      <div className="p-2 border rounded bg-light">
                        <small className="text-muted d-block">Presión</small>
                        <span className={`fs-4 fw-bold ${pressure < 200 ? 'text-warning' : 'text-danger'}`}>
                          {pressure}
                        </span>
                        <small className="d-block text-muted">PSI</small>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 border rounded bg-light">
                        <small className="text-muted d-block">Temperatura</small>
                        <span className={`fs-4 fw-bold ${temperature > 30 || temperature < -15 ? 'text-danger' : 'text-success'}`}>
                          {temperature}
                        </span>
                        <small className="d-block text-muted">°C</small>
                        <small className="text-muted" style={{ fontSize: '10px' }}>Óptimo: -15°C a 30°C</small>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 border rounded bg-light">
                        <small className="text-muted d-block">Flujo Gas</small>
                        <span className={`fs-4 fw-bold ${gasFlow < 300 ? 'text-[#8e44ad]' : 'text-info'}`}>
                          {gasFlow}
                        </span>
                        <small className="d-block text-muted">m³/h</small>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h6 className="fw-bold text-secondary mb-2">Estado de Maquinaria OT</h6>
                    <div className="d-flex flex-wrap gap-2">
                      <button 
                        onClick={() => toggleEquipment('compresor')} 
                        disabled={user.role !== 'admin'}
                        className={`btn btn-sm flex-fill ${equipments.compresor ? 'btn-success' : 'btn-danger'}`}
                      >
                        Compresor: {equipments.compresor ? 'ON (Presurizando)' : 'OFF (Baja Presión)'}
                      </button>

                      <button 
                        onClick={() => toggleEquipment('refrigeracion')} 
                        disabled={user.role !== 'admin'}
                        className={`btn btn-sm flex-fill ${equipments.refrigeracion ? 'btn-success' : 'btn-danger fw-bold'}`}
                      >
                        Chiller: {equipments.refrigeracion ? 'ON (Enfriando)' : 'OFF (Riesgo Autoignición)'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              <div className="col-md-4">
                <div className="scada-card p-3 h-100 text-center">
                  <h6 className="fw-bold text-secondary mb-2">Composición Química del Mezclado</h6>
                  <div style={{ height: '210px' }} className="d-flex justify-content-center">
                    <Doughnut data={chemicalData} options={chemicalOptions} />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN DE GRÁFICOS HISTÓRICOS Y FLUCTUACIÓN */}
            <div className="row g-3 mb-3">
              
              <div className="col-md-8">
                {/* GRÁFICO PRINCIPAL COMBINADO (SIN SOMBREADO DE AUTOIGNICIÓN) */}
                <div className="scada-card p-3 mb-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <h6 className="fw-bold text-secondary m-0">Histórico General: Presión vs Temperatura</h6>
                    
                    <div className="btn-group btn-group-sm mt-2 mt-sm-0" role="group">
                      <button 
                        className={`btn ${timeFilter === 'today' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setTimeFilter('today')}
                      >
                        Hoy ({formattedTodayDate})
                      </button>
                      <button 
                        className={`btn ${timeFilter === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setTimeFilter('week')}
                      >
                        Semana
                      </button>
                      <button 
                        className={`btn ${timeFilter === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setTimeFilter('month')}
                      >
                        Mes
                      </button>
                      <button 
                        className={`btn ${timeFilter === 'year' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setTimeFilter('year')}
                      >
                        Año ({currentYear})
                      </button>
                      <button 
                        className={`btn ${timeFilter === 'custom' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setTimeFilter('custom')}
                      >
                        Personalizado
                      </button>
                    </div>
                  </div>

                  {timeFilter === 'custom' && (
                    <div className="d-flex align-items-center gap-2 mb-3 bg-light p-2 rounded border">
                      <span className="small fw-bold text-secondary">Registro histórico desde el año:</span>
                      <input 
                        type="number" 
                        min="1952" 
                        max={currentYear} 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Math.min(currentYear, Math.max(1952, parseInt(e.target.value) || 1952)))}
                        className="form-control form-control-sm" 
                        style={{ width: '100px' }}
                      />
                      <small className="text-muted ms-2">(Planta en operación desde 1952)</small>
                    </div>
                  )}

                  <Line data={mainChartData} options={mainChartOptions} />
                </div>

                {/* SUB-SECCIÓN: 2 MINIGRÁFICOS INDIVIDUALES (PRESIÓN Y TEMPERATURA) */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="scada-card p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="fw-bold text-danger text-uppercase">🔴 Monitoreo de Presión</small>
                        <small className="text-muted" style={{ fontSize: '10px' }}>
                          {timeFilter.toUpperCase()}
                        </small>
                      </div>
                      <div style={{ height: '160px' }}>
                        <Line data={pressureOnlyData} options={pressureOnlyOptions} />
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="scada-card p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="fw-bold text-warning text-uppercase">🟠 Monitoreo de Temperatura</small>
                        <small className="text-muted" style={{ fontSize: '10px' }}>
                          {timeFilter.toUpperCase()}
                        </small>
                      </div>
                      <div style={{ height: '160px' }}>
                        <Line data={tempOnlyData} options={tempOnlyOptions} plugins={[prohibitedZonePlugin]} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RECUADRO DE FLUCTUACIÓN SCADA */}
              <div className="col-md-4">
                <div className="scada-card p-3 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <h6 className="fw-bold text-light mb-1">
                      Fluctuación SCADA {timeFilter === 'today' ? '(Live Ticker)' : '(Histórica)'}
                    </h6>
                    <small className="text-muted d-block mb-3">{subtitle}</small>

                    {/* TARJETA DE PRESIÓN */}
                    <div 
                      className="p-3 rounded mb-3 shadow-sm" 
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold text-light">Presión (PSI)</span>
                        <span className={`badge fs-6 ${stats.pDiff >= 0 ? 'bg-success' : 'bg-danger'}`}>
                          {stats.pDiff >= 0 ? `+${stats.pPct}%` : `${stats.pPct}%`}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-end">
                        <span className="fs-3 fw-bold text-white">{stats.pVal} <small className="fs-6 text-muted">PSI</small></span>
                        <small className={`fw-bold ${stats.pDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                          {stats.pDiff >= 0 ? `▲ +${stats.pDiff} PSI` : `▼ ${stats.pDiff} PSI`}
                        </small>
                      </div>
                    </div>

                    {/* TARJETA DE TEMPERATURA */}
                    <div 
                      className="p-3 rounded mb-3 shadow-sm" 
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold text-light">Temperatura (°C)</span>
                        <span className={`badge fs-6 ${stats.tDiff >= 0 ? 'bg-danger' : 'bg-success'}`}>
                          {stats.tDiff >= 0 ? `+${stats.tPct}%` : `${stats.tPct}%`}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-end">
                        <span className="fs-3 fw-bold text-white">{stats.tVal} <small className="fs-6 text-muted">°C</small></span>
                        <small className={`fw-bold ${stats.tDiff >= 0 ? 'text-danger' : 'text-success'}`}>
                          {stats.tDiff >= 0 ? `▲ +${stats.tDiff} °C` : `▼ ${stats.tDiff} °C`}
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* INDICADOR RESUMEN */}
                  <div 
                    className="p-2 rounded text-center" 
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                  >
                    <small className="text-muted d-block mb-1">Rango Óptimo Almacenamiento: -15 °C a 30 °C</small>
                    <span className={`fw-bold ${isCriticalAutoignition ? 'text-danger' : (isHighTemp ? 'text-warning' : 'text-info')}`}>
                      {isCriticalAutoignition ? '💥 DANGER: AUTOIGNICIÓN' : (isHighTemp ? '⚠️ ELEVACIÓN TÉRMICA' : 'ESTABLE (NORMAL)')}
                    </span>
                  </div>

                </div>
              </div>

            </div>

            {/* SECCIÓN INFERIOR */}
            <div className="row g-3">
              <div className="col-md-6">
                <div className="scada-card p-3 text-center h-100 d-flex flex-column justify-content-between">
                  <div className="d-flex justify-content-between align-items-center mb-2 px-2">
                    <h6 className="fw-bold text-secondary m-0">Torres de Escape y Calderas de Ventilación</h6>
                    <span className={`badge ${systemPower ? 'bg-success' : 'bg-secondary'}`}>
                      {systemPower ? 'EMISIÓN ACTIVA (130°C - 180°C)' : 'INACTIVO'}
                    </span>
                  </div>
                  <IndustrialChimneys isOperating={systemPower} />
                </div>
              </div>

              <div className="col-md-6">
                <div className="scada-card p-3 h-100 d-flex flex-column justify-content-between">
                  <h6 className="fw-bold text-secondary mb-3">Red de Distribución por Sectores</h6>
                  <ul className="list-group list-group-flush flex-grow-1 d-flex flex-column justify-content-around">
                    <li className="list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent">
                      <span className="fw-medium text-dark">Sector A - Matriz Norte</span>
                      <span className="badge bg-success">48 bar - Normal</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent">
                      <span className="fw-medium text-dark">Sector B - Estación Compresora</span>
                      <span className={`badge ${equipments.compresor ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {equipments.compresor ? '52 bar - Normal' : '18 bar - Compresor Detenido'}
                      </span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent">
                      <span className="fw-medium text-dark">Sector C - Distribución Sur</span>
                      <span className={`badge ${leakDetected ? 'bg-danger' : 'bg-success'}`}>
                        {leakDetected ? '32 bar - FUGA' : '45 bar - Normal'}
                      </span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent">
                      <span className="fw-medium text-dark">Sector D - Tanques Almacenamiento</span>
                      <span className="badge bg-success">{tankLevel.toFixed(0)}% L - Normal</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* VISTA 2: PANEL DE LUCES RGB */}
        {/* ========================================================================= */}
        {activeTab === 'rgb' && (
          <div className="row justify-content-center">
            <div className="col-lg-10">
              
              <div className="scada-card p-4 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3 className="fw-bold text-light m-0">Controlador de Luces RGB SCADA</h3>
                    <small className="text-muted">Simulación de flujo eléctrico y espectro de color en canalizaciones LED</small>
                  </div>
                  
                  <button 
                    onClick={() => setRgbPower(!rgbPower)}
                    className={`btn px-4 py-2 fw-bold d-flex align-items-center gap-2 ${rgbPower ? 'btn-danger' : 'btn-success'}`}
                  >
                    <span>{rgbPower ? '🛑 APAGAR LUCES' : '⚡ ENCENDER LUCES'}</span>
                  </button>
                </div>

                <hr className="border-secondary my-4" />

                <div className="mb-4">
                  <label className="fw-bold text-light mb-2 d-flex justify-content-between">
                    <span>Tira Dinámica de Flujo Eléctrico / Óptico:</span>
                    <span className="text-info">{rgbPower ? `RGB(${activeColor.r}, ${activeColor.g}, ${activeColor.b})` : 'APAGADO'}</span>
                  </label>

                  <div 
                    className={`rgb-strip-container ${rgbPower ? 'on' : 'off'}`}
                    style={{ '--glow-color': glowShadowColor }}
                  >
                    {rgbPower ? (
                      <div className="rgb-wave-bar" style={waveGradientStyle} />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100 text-muted fw-bold">
                        [ ILUMINACIÓN DESACTIVADA ]
                      </div>
                    )}
                    <div className="rgb-glass-overlay" />
                  </div>
                </div>

                <div className="row g-3 align-items-end mb-3">
                  <div className="col-md-7">
                    <label className="form-label text-light fw-bold">
                      Valores RGB (Formato: R, G, B de 0 a 255):
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-dark text-light border-secondary">rgb(</span>
                      <input 
                        type="text" 
                        value={rgbInputText}
                        onChange={(e) => setRgbInputText(e.target.value)}
                        placeholder="255, 0, 128"
                        disabled={!rgbPower}
                        className="form-control bg-dark text-white border-secondary fs-5 fw-bold"
                      />
                      <span className="input-group-text bg-dark text-light border-secondary">)</span>
                      <button 
                        onClick={handleApplyRgb}
                        disabled={!rgbPower}
                        className="btn btn-primary fw-bold px-4"
                      >
                        Aplicar
                      </button>
                    </div>
                    {rgbError && <small className="text-danger mt-1 d-block fw-semibold">{rgbError}</small>}
                  </div>

                  <div className="col-md-5">
                    <label className="form-label text-light fw-bold d-block">Colores Rápidos:</label>
                    <div className="d-flex gap-2 flex-wrap">
                      <button 
                        disabled={!rgbPower} 
                        onClick={() => applyPresetColor(255, 0, 0)} 
                        className="btn btn-sm text-white fw-bold flex-fill" 
                        style={{ backgroundColor: '#e74c3c' }}
                      >
                        Rojo
                      </button>
                      <button 
                        disabled={!rgbPower} 
                        onClick={() => applyPresetColor(0, 255, 0)} 
                        className="btn btn-sm text-dark fw-bold flex-fill" 
                        style={{ backgroundColor: '#2ecc71' }}
                      >
                        Verde
                      </button>
                      <button 
                        disabled={!rgbPower} 
                        onClick={() => applyPresetColor(0, 128, 255)} 
                        className="btn btn-sm text-white fw-bold flex-fill" 
                        style={{ backgroundColor: '#3498db' }}
                      >
                        Azul
                      </button>
                      <button 
                        disabled={!rgbPower} 
                        onClick={() => applyPresetColor(255, 0, 255)} 
                        className="btn btn-sm text-white fw-bold flex-fill" 
                        style={{ backgroundColor: '#9b59b6' }}
                      >
                        Magenta
                      </button>
                      <button 
                        disabled={!rgbPower} 
                        onClick={() => applyPresetColor(255, 230, 0)} 
                        className="btn btn-sm text-dark fw-bold flex-fill" 
                        style={{ backgroundColor: '#f1c40f' }}
                      >
                        Amarillo
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
