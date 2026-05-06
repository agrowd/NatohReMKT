import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

// --- ICONOS SVG PREMIUM (CORREGIDOS) ---
const Icon = ({ name, size = 24 }) => {
  const icons = {
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    connection: <><path d="M18 4l2 2-6 6M4 20l2-2 6-6M9 9l1.5 1.5M13.5 13.5L15 15M21 3l-2 2M3 21l2-2"/></>,
    history: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

function App() {
  const [status, setStatus] = useState('DESCONECTADO');
  const [qr, setQr] = useState(null);
  const [labels, setLabels] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [flowSteps, setFlowSteps] = useState([{ id: 1, type: 'message', content: '¡Hola! Tenemos novedades para vos 🚀' }]);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    socket.on('qr', (data) => { setQr(data); setStatus('ESPERANDO ESCANEO'); setIsStarting(false); });
    socket.on('ready', () => { setStatus('BOT ONLINE'); setQr(null); setIsStarting(false); fetchLabels(); });
    socket.on('labels', (data) => { setLabels(data || []); });
    socket.on('disconnected', () => { setStatus('DESCONECTADO'); setQr(null); setLabels([]); });
    fetchLabels();
    fetchCampaigns();
    return () => { socket.off('qr'); socket.off('ready'); socket.off('labels'); socket.off('disconnected'); };
  }, []);

  const fetchLabels = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/labels`);
      if (res.data && res.data.length > 0) setLabels(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/campaigns`);
      setCampaigns(res.data || []);
    } catch (e) { console.error(e); }
  };

  const startBot = async () => {
    setIsStarting(true);
    try { await axios.post(`${API_URL}/api/whatsapp/start`); } catch (e) { setIsStarting(false); alert("Error al iniciar"); }
  };

  const stopBot = async () => {
    try { await axios.post(`${API_URL}/api/whatsapp/stop`); } catch (e) { alert("Error al detener"); }
  };

  const logoutBot = async () => {
    if (!window.confirm("¿Seguro que querés cerrar sesión? Se borrarán los datos de conexión.")) return;
    try { await axios.post(`${API_URL}/api/whatsapp/logout`); alert("Sesión cerrada."); } catch (e) { alert("Error"); }
  };

  const startCampaign = async () => {
    if (status !== 'BOT ONLINE') return alert('Conectá el bot primero');
    if (!selectedLabel) return alert('Seleccioná una etiqueta');
    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Camp. ${new Date().toLocaleTimeString()}`, steps: flowSteps });
      await axios.post(`${API_URL}/api/campaigns`, { flowId: flowRes.data.id, labelId: selectedLabel.id });
      alert('Campaña en marcha');
    } catch (e) { alert("Error"); }
  };

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ marginBottom: '2rem' }}><Icon name="zap" size={32} /></div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}><Icon name="home" /></div>
        <div className={`nav-item ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')}><Icon name="connection" /></div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><Icon name="history" /></div>
      </nav>

      <div className="main-layout">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-1px' }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'BOT ONLINE' ? 'dot-ready' : 'dot-waiting'}`} />
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{status}</span>
            </div>
          </div>
          {status === 'BOT ONLINE' && <button className="btn" onClick={fetchLabels} style={{ background: 'var(--glass)', color: '#fff' }}><Icon name="refresh" size={18}/> Etiquetas</button>}
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%' }}>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '1px' }}>Etiquetas Disponibles</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabel?.id === l.id ? 'active' : ''}`} onClick={() => setSelectedLabel(l)}>
                    <div style={{ fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{l.id}</div>
                  </div>
                ))}
              </aside>
              <main className="workspace">
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <h2 style={{ fontSize: '1.8rem' }}>Constructor</h2>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', content: '' }])}>+ Texto</button>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'delay', duration: 10 }])}>+ Espera</button>
                    </div>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', opacity: 0.5, fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 700 }}>PASO {i+1} • {step.type.toUpperCase()}</span>
                        <span style={{ cursor: 'pointer' }} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))}><Icon name="trash" size={16}/></span>
                      </div>
                      {step.type === 'message' ? (
                        <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} placeholder="Escribí el mensaje de remarketing..." rows={4} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '14px' }}>
                           <Icon name="history" size={20} />
                           <span style={{ fontWeight: 600 }}>Esperar</span>
                           <input type="number" value={step.duration} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, duration: e.target.value } : s))} style={{ width: '80px', background: 'transparent', border: 'none', borderBottom: '2px solid var(--primary)', color: '#fff', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }} />
                           <span style={{ opacity: 0.6 }}>segundos</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '65px', fontSize: '1.1rem' }} onClick={startCampaign}>🚀 LANZAR CAMPAÑA</button>
                </div>
              </main>
            </div>
          )}

          {activeTab === 'connection' && (
            <div className="workspace">
              <div className="glass-card" style={{ maxWidth: '600px', textAlign: 'center' }}>
                <Icon name="connection" size={48} style={{ color: '#00ff88', marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Conexión</h2>
                <p style={{ opacity: 0.5, marginBottom: '3rem' }}>Vinculá tu WhatsApp Business para empezar</p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '3rem' }}>
                  <button className="btn" onClick={status === 'DESCONECTADO' ? startBot : stopBot} 
                          style={{ background: status === 'DESCONECTADO' ? 'var(--primary)' : '#ff4444', color: '#000', padding: '1.2rem 2.5rem', flex: 1 }}>
                    {isStarting ? 'INICIANDO...' : status === 'DESCONECTADO' ? 'ENCENDER' : 'DETENER'}
                  </button>
                  <button className="btn" onClick={logoutBot} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '1.2rem 1.5rem' }}>
                    BORRAR SESIÓN
                  </button>
                </div>

                {qr && (
                  <div className="qr-box">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" />
                    <p style={{ color: '#000', fontWeight: 700, marginTop: '1rem', fontSize: '0.9rem' }}>ESCANEÁ DESDE WHATSAPP</p>
                  </div>
                )}

                {status === 'BOT ONLINE' && (
                  <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--primary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                    <h3 style={{ color: 'var(--primary)', margin: 0 }}>VINCULACIÓN EXITOSA</h3>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="workspace">
               <div className="glass-card">
                 <h2 style={{ marginBottom: '2rem' }}>Historial</h2>
                 {campaigns.map(c => (
                   <div key={c.id} className="label-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ fontWeight: 700 }}>{c.flow_name}</div>
                       <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{new Date(c.created_at).toLocaleString()}</div>
                     </div>
                     <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: 700 }}>
                        {c.sent_count}/{c.total_count} ✅
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
