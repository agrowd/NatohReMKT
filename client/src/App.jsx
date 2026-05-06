import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

// --- ICONOS SVG ---
const Icon = ({ name, size = 24 }) => {
  const icons = {
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    connection: <><path d="M18 4l2 2-6 6M4 20l2-2 6-6M9 9l1.5 1.5M13.5 13.5L15 15M21 3l-2 2M3 21l2-2"/></>,
    history: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>
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
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [activeTab, setActiveTab] = useState('builder');
  const [flowSteps, setFlowSteps] = useState([{ id: 1, type: 'message', content: '¡Hola! Novedades 🚀' }]);
  const [campaigns, setCampaigns] = useState([]);
  const [config, setConfig] = useState({ minLeadDelay: 30, maxLeadDelay: 90, minStepDelay: 5, maxStepDelay: 15 });

  useEffect(() => {
    socket.on('qr', (data) => { setQr(data); setStatus('ESPERANDO ESCANEO'); });
    socket.on('ready', () => { setStatus('BOT ONLINE'); setQr(null); fetchLabels(); });
    socket.on('labels', (data) => { setLabels(data || []); });
    socket.on('disconnected', () => { setStatus('DESCONECTADO'); setLabels([]); });
    fetchLabels(); fetchCampaigns();
    return () => { socket.off('qr'); socket.off('ready'); socket.off('labels'); socket.off('disconnected'); };
  }, []);

  const fetchLabels = async () => {
    try { const res = await axios.get(`${API_URL}/api/labels`); if (res.data) setLabels(res.data); } catch (e) {}
  };

  const fetchCampaigns = async () => {
    try { const res = await axios.get(`${API_URL}/api/campaigns`); setCampaigns(res.data || []); } catch (e) {}
  };

  const toggleLabel = (id) => {
    if (selectedLabels.includes(id)) { setSelectedLabels(selectedLabels.filter(l => l !== id)); }
    else { setSelectedLabels([...selectedLabels, id]); }
  };

  const startCampaign = async () => {
    if (status !== 'BOT ONLINE') return alert('Bot desconectado');
    if (selectedLabels.length === 0) return alert('Seleccioná al menos una etiqueta');
    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Camp. ${new Date().toLocaleTimeString()}`, steps: flowSteps });
      await axios.post(`${API_URL}/api/campaigns`, { flowId: flowRes.data.id, labelIds: selectedLabels, config });
      alert('¡Campaña iniciada!');
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
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'BOT ONLINE' ? 'dot-ready' : 'dot-waiting'}`} />
              <span style={{ fontSize: '0.8rem' }}>{status}</span>
            </div>
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%' }}>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '1.5rem' }}>Etiquetas</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabels.includes(l.id) ? 'active' : ''}`} onClick={() => toggleLabel(l.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div style={{ fontWeight: 600 }}>{l.name}</div>
                       {selectedLabels.includes(l.id) && <span style={{ color: 'var(--primary)' }}>✓</span>}
                    </div>
                  </div>
                ))}
              </aside>
              <main className="workspace">
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <Icon name="settings" size={20} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0 }}>Protección Anti-Spam (Aleatorio)</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', opacity: 0.5 }}>Entre Personas (segundos)</label>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                        <input type="number" value={config.minLeadDelay} onChange={(e) => setConfig({...config, minLeadDelay: parseInt(e.target.value)})} placeholder="Min" style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                        <input type="number" value={config.maxLeadDelay} onChange={(e) => setConfig({...config, maxLeadDelay: parseInt(e.target.value)})} placeholder="Max" style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', opacity: 0.5 }}>Entre Mensajes (segundos)</label>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                        <input type="number" value={config.minStepDelay} onChange={(e) => setConfig({...config, minStepDelay: parseInt(e.target.value)})} placeholder="Min" style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                        <input type="number" value={config.maxStepDelay} onChange={(e) => setConfig({...config, maxStepDelay: parseInt(e.target.value)})} placeholder="Max" style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0 }}>Constructor</h2>
                    <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', content: '' }])}>+ Mensaje</button>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.5 }}>
                        <span>MENSAJE {i+1}</span>
                        <span style={{ cursor: 'pointer' }} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))}><Icon name="trash" size={16}/></span>
                      </div>
                      <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} rows={3} />
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '60px' }} onClick={startCampaign}>🚀 INICIAR</button>
                </div>
              </main>
            </div>
          )}

          {activeTab === 'connection' && (
             <div className="workspace">
                <div className="glass-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
                  <Icon name="connection" size={48} style={{ color: '#00ff88', marginBottom: '1rem' }} />
                  <h2>Conexión</h2>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '2rem 0' }}>
                    <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/start`)} style={{ background: 'var(--primary)', color: '#000' }}>ENCENDER</button>
                    <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/logout`)} style={{ background: '#333', color: '#fff' }}>LOGOUT</button>
                  </div>
                  {qr && <div className="qr-box"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" /></div>}
                </div>
             </div>
          )}

          {activeTab === 'history' && (
             <div className="workspace">
                <div className="glass-card">
                  <h2>Historial</h2>
                  {campaigns.map(c => (
                    <div key={c.id} className="label-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.flow_name}</span>
                      <span>{c.sent_count}/{c.total_count}</span>
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
