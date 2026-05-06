import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

// INTERFAZ DE EMERGENCIA - SIN LIBRERIAS EXTERNAS (SOLO REACT + AXIOS + SOCKET)
const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

function App() {
  const [status, setStatus] = useState('DESCONECTADO');
  const [qr, setQr] = useState(null);
  const [labels, setLabels] = useState([]);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    console.log("App cargada con exito");
    
    socket.on('qr', (data) => {
      console.log("QR recibido");
      setQr(data);
      setStatus('ESPERANDO ESCANEO');
      setIsStarting(false);
    });

    socket.on('ready', () => {
      console.log("Bot listo");
      setStatus('BOT ONLINE');
      setQr(null);
      setIsStarting(false);
      fetchLabels();
    });

    socket.on('disconnected', () => {
      setStatus('DESCONECTADO');
      setQr(null);
    });

    return () => {
      socket.off('qr');
      socket.off('ready');
      socket.off('disconnected');
    };
  }, []);

  const fetchLabels = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/labels`);
      setLabels(res.data || []);
    } catch (e) { console.error(e); }
  };

  const startBot = async () => {
    setIsStarting(true);
    try {
      await axios.post(`${API_URL}/api/whatsapp/start`);
    } catch (e) {
      setIsStarting(false);
      alert("Error al iniciar");
    }
  };

  const stopBot = async () => {
    try {
      await axios.post(`${API_URL}/api/whatsapp/stop`);
    } catch (e) { alert("Error al detener"); }
  };

  return (
    <div style={{ 
      background: '#111', 
      color: 'white', 
      minHeight: '100vh', 
      padding: '20px', 
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <h1 style={{ color: '#00ff88' }}>NATOH REMARKETING - MODO SEGURO</h1>
      <p>Si ves esto, la web esta funcionando correctamente.</p>
      
      <div style={{ 
        margin: '20px', 
        padding: '20px', 
        border: '1px solid #333', 
        borderRadius: '10px',
        textAlign: 'center',
        background: '#222'
      }}>
        <h2>Estado: <span style={{ color: status === 'BOT ONLINE' ? '#00ff88' : '#ffaa00' }}>{status}</span></h2>
        
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={startBot} 
            disabled={isStarting || status === 'BOT ONLINE'}
            style={{ padding: '10px 20px', cursor: 'pointer', background: '#00ff88', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}
          >
            {isStarting ? 'INICIANDO...' : 'ENCENDER BOT'}
          </button>
          
          <button 
            onClick={stopBot}
            style={{ padding: '10px 20px', cursor: 'pointer', background: '#ff4444', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}
          >
            APAGAR BOT
          </button>
        </div>
      </div>

      {qr && (
        <div style={{ background: 'white', padding: '10px', borderRadius: '10px', marginTop: '20px' }}>
          <p style={{ color: 'black', textAlign: 'center', fontWeight: 'bold' }}>ESCANEA ESTE QR:</p>
          {/* Usamos una imagen de QR generada por API externa para no depender de librerias locales */}
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR Code" />
        </div>
      )}

      {status === 'BOT ONLINE' && (
        <div style={{ marginTop: '30px', width: '100%', maxWidth: '600px' }}>
          <h3>Tus Etiquetas:</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {labels.map(l => (
              <li key={l.id} style={{ padding: '10px', borderBottom: '1px solid #333' }}>
                {l.name}
              </li>
            ))}
            {labels.length === 0 && <li>Cargando etiquetas...</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
