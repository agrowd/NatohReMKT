import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

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
    try { 
      await axios.post(`${API_URL}/api/whatsapp/logout`); 
      alert("Sesión cerrada correctamente.");
    } catch (e) { alert("Error al cerrar sesión"); }
  };

  const startCampaign = async () => {
    if (status !== 'BOT ONLINE') return alert('El bot debe estar conectado');
    if (!selectedLabel) return alert('Seleccioná una etiqueta');
    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Campaña ${new Date().toLocaleString()}`, steps: flowSteps });
      await axios.post(`${API_URL}/api/campaigns`, { flowId: flowRes.data.id, labelId: selectedLabel.id });
      alert('¡Campaña iniciada!');
    } catch (e) { alert("Error al iniciar campaña"); }
  };

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ fontSize: '1.2rem' }}>⚡</div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')} title="Constructor">🏠</div>
        <div className={`nav-item ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')} title="Conexión">🔌</div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} title="Historial">📜</div>
      </nav>

      <div className="main-layout">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'BOT ONLINE' ? 'dot-ready' : 'dot-waiting'}`} />
              <span style={{ fontSize: '0.7rem' }}>{status}</span>
            </div>
          </div>
          {status === 'BOT ONLINE' && <button className="btn" onClick={fetchLabels} style={{ background: 'var(--glass)', color: '#fff' }}>🔄 Etiquetas</button>}
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '100%' }}>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '1rem' }}>ETIQUETAS ({labels.length})</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabel?.id === l.id ? 'active' : ''}`} onClick={() => setSelectedLabel(l)}>
                    {l.name}
                  </div>
                ))}
              </aside>
              <main className="workspace">
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Constructor</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', content: '' }])}>+ Texto</button>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'delay', duration: 10 }])}>+ Espera</button>
                    </div>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: 0.5, fontSize: '0.7rem' }}>
                        <span>PASO {i+1} - {step.type.toUpperCase()}</span>
                        <span style={{ cursor: 'pointer' }} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))}>❌</span>
                      </div>
                      {step.type === 'message' ? (
                        <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} placeholder="Escribí el mensaje..." rows={3} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                           <span>Esperar</span>
                           <input type="number" value={step.duration} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, duration: e.target.value } : s))} style={{ width: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '5px' }} />
                           <span>segundos</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '50px' }} onClick={startCampaign}>🚀 INICIAR ENVÍO</button>
                </div>
              </main>
            </div>
          )}

          {activeTab === 'connection' && (
            <div className="workspace">
              <div className="glass-card" style={{ maxWidth: '600px', textAlign: 'center' }}>
                <h2>Centro de Conexión</h2>
                <p style={{ opacity: 0.5, marginBottom: '2rem' }}>Gestioná tu vinculación con WhatsApp</p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '2rem' }}>
                  <button className="btn" onClick={status === 'DESCONECTADO' ? startBot : stopBot} 
                          style={{ background: status === 'DESCONECTADO' ? 'var(--primary)' : '#ff4444', color: '#000', padding: '1rem 2rem' }}>
                    {isStarting ? 'INICIANDO...' : status === 'DESCONECTADO' ? 'ENCENDER BOT' : 'DETENER BOT'}
                  </button>
                  <button className="btn" onClick={logoutBot} style={{ background: '#333', color: '#fff', padding: '1rem 2rem' }}>
                    CERRAR SESIÓN
                  </button>
                </div>

                {qr && (
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', display: 'inline-block' }}>
                    <p style={{ color: '#000', fontWeight: 'bold', marginBottom: '10px' }}>ESCANEA EL QR:</p>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" />
                  </div>
                )}

                {status === 'BOT ONLINE' && (
                  <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '2rem' }}>
                    ✅ BOT VINCULADO Y LISTO
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="workspace">
               <div className="glass-card">
                 <h2>Historial de Campañas</h2>
                 {campaigns.map(c => (
                   <div key={c.id} className="label-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                     <span>{c.flow_name}</span>
                     <span style={{ opacity: 0.5 }}>{c.sent_count}/{c.total_count} enviados</span>
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
