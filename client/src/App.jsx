import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

// --- ICONOS SVG PREMIUM (RESETEADOS Y BLINDADOS) ---
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="var(--primary)" stroke="none" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    connection: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    history: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || <circle cx="12" cy="12" r="5" />}
    </svg>
  );
};

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('natoh_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [status, setStatus] = useState('VERIFICANDO...');
  const [qr, setQr] = useState(null);
  const [labels, setLabels] = useState([]);
  const [activeTab, setActiveTab] = useState('builder');
  const [campaigns, setCampaigns] = useState([]);
  const [savedFlows, setSavedFlows] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState(null);

  const [selectedLabels, setSelectedLabels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedLabels') || '[]'); } catch(e) { return []; }
  });
  const [flowSteps, setFlowSteps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flowSteps') || '[{"id":1,"type":"message","content":"¡Hola! 🚀"}]'); } catch(e) { return [{"id":1,"type":"message","content":"¡Hola! 🚀"}]; }
  });
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('antiSpamConfig') || '{"minLeadDelay":30,"maxLeadDelay":90,"minStepDelay":5,"maxStepDelay":15}'); } catch(e) { return {"minLeadDelay":30,"maxLeadDelay":90,"minStepDelay":5,"maxStepDelay":15}; }
  });

  useEffect(() => {
    if (!user) return;
    localStorage.setItem('selectedLabels', JSON.stringify(selectedLabels));
    localStorage.setItem('flowSteps', JSON.stringify(flowSteps));
    localStorage.setItem('antiSpamConfig', JSON.stringify(config));
  }, [selectedLabels, flowSteps, config, user]);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API_URL}/api/whatsapp/status`).then(res => {
      setStatus(res.data.status); setQr(res.data.qr);
      if (res.data.activeCampaign) setActiveCampaign(res.data.activeCampaign);
      if (res.data.status === 'BOT ONLINE') fetchLabels();
    }).catch(() => setStatus('ERROR'));

    socket.on('status', (s) => setStatus(s));
    socket.on('qr', (data) => { setQr(data); setStatus('ESPERANDO ESCANEO'); });
    socket.on('ready', () => { setStatus('BOT ONLINE'); setQr(null); fetchLabels(); });
    socket.on('labels', (data) => setLabels(data || []));
    socket.on('campaign_progress', (data) => setActiveCampaign(data));
    socket.on('campaign_finished', () => { setActiveCampaign(null); fetchCampaigns(); });
    
    fetchCampaigns(); fetchFlows();
    return () => { socket.off('status'); socket.off('qr'); socket.off('ready'); socket.off('labels'); socket.off('campaign_progress'); socket.off('campaign_finished'); };
  }, [user]);

  const fetchLabels = async () => { try { const res = await axios.get(`${API_URL}/api/labels`); setLabels(res.data || []); } catch (e) {} };
  const fetchCampaigns = async () => { try { const res = await axios.get(`${API_URL}/api/campaigns`); setCampaigns(res.data || []); } catch (e) {} };
  const fetchFlows = async () => { try { const res = await axios.get(`${API_URL}/api/flows`); setSavedFlows(res.data || []); } catch (e) {} };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/login`, loginForm);
      if (res.data.success) {
        setUser(res.data.user);
        localStorage.setItem('natoh_user', JSON.stringify(res.data.user));
      }
    } catch (e) { alert("Error de acceso"); }
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem('natoh_user'); };

  if (!user) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '3rem' }}>
          <Icon name="zap" size={60} />
          <h2 style={{ fontSize: '2rem', margin: '1.5rem 0 2rem 0', fontWeight: 800 }}>NatohReMKT</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" placeholder="Usuario" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '12px', color: '#fff' }} required />
            <input type="password" placeholder="Contraseña" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '12px', color: '#fff' }} required />
            <button type="submit" className="btn btn-primary" style={{ height: '55px', marginTop: '1rem' }}>ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ marginBottom: '2.5rem' }}><Icon name="zap" size={28} /></div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')} title="Constructor"><Icon name="home" /></div>
        <div className={`nav-item ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')} title="Conexión"><Icon name="connection" /></div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} title="Historial"><Icon name="history" /></div>
        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Configuración"><Icon name="settings" /></div>
        <div className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto' }} title="Salir"><Icon name="logout" color="#ff4444" /></div>
      </nav>

      <div className="main-layout">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'BOT ONLINE' ? 'dot-ready' : 'dot-waiting'}`} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{status}</span>
            </div>
            {activeCampaign && (
              <div className="campaign-progress-bar">
                <span>⚡ {activeCampaign.sentCount} / {activeCampaign.total}</span>
                <div className="progress-bg"><div className="progress-fill" style={{ width: `${(activeCampaign.sentCount / activeCampaign.total) * 100}%` }} /></div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{user.username} ({user.role})</span>
             {status === 'BOT ONLINE' && <button className="btn" onClick={fetchLabels} style={{ background: 'var(--glass)', color: '#fff' }}><Icon name="refresh" size={16}/> Sincronizar</button>}
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%', height: '100%' }}>
              <aside className="sub-sidebar">
                <h3 className="section-title">Flujos Guardados</h3>
                {savedFlows.map(f => (
                  <div key={f.id} className="label-item" onClick={() => setFlowSteps(JSON.parse(f.steps))}>{f.name}</div>
                ))}
                <h3 className="section-title" style={{ marginTop: '2rem' }}>Etiquetas WA</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabels.includes(l.id) ? 'active' : ''}`} onClick={() => setSelectedLabels(selectedLabels.includes(l.id) ? selectedLabels.filter(x => x !== l.id) : [...selectedLabels, l.id])}>
                    {l.name} {selectedLabels.includes(l.id) && '✓'}
                  </div>
                ))}
              </aside>
              <main className="workspace">
                 <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <label className="input-label">Delay Leads (Seg)</label>
                      <input type="number" value={config.minLeadDelay} onChange={(e) => setConfig({...config, minLeadDelay: parseInt(e.target.value)})} className="styled-input" />
                    </div>
                    <div>
                      <label className="input-label">Delay Pasos (Seg)</label>
                      <input type="number" value={config.minStepDelay} onChange={(e) => setConfig({...config, minStepDelay: parseInt(e.target.value)})} className="styled-input" />
                    </div>
                  </div>
                </div>
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem' }}>Estrategia de Mensajes</h2>
                    <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', content: '' }])}>+ Bloque</button>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>PASO #{i+1}</span>
                        <Icon name="trash" size={14} color="#ff4444" onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))} />
                      </div>
                      <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} rows={3} className="styled-textarea" placeholder="Escribí tu mensaje aquí..." />
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', height: '55px', marginTop: '1rem' }} onClick={() => setShowModal(true)}>🚀 LANZAR CAMPAÑA</button>
                </div>
              </main>
            </div>
          )}

          {activeTab === 'connection' && (
             <div className="workspace">
                <div className="glass-card" style={{ textAlign: 'center', maxWidth: '450px' }}>
                  <Icon name="connection" size={60} />
                  <h2 style={{ margin: '1.5rem 0' }}>Conexión WhatsApp</h2>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => axios.post(`${API_URL}/api/whatsapp/start`)}>ENCENDER</button>
                    <button className="btn" style={{ flex: 1, background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' }} onClick={() => axios.post(`${API_URL}/api/whatsapp/stop`)}>APAGAR</button>
                  </div>
                  {qr && <div className="qr-container"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" /></div>}
                  {status === 'BOT ONLINE' && <div className="success-badge">✅ BOT CONECTADO CORRECTAMENTE</div>}
                </div>
             </div>
          )}

          {activeTab === 'history' && (
             <div className="workspace">
                <div className="glass-card">
                  <h2>Historial de Envíos</h2>
                  {campaigns.map(c => (
                    <div key={c.id} className="history-row" onClick={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.flow_name}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>{new Date(c.created_at).toLocaleString()}</div>
                        </div>
                        <div className="count-badge">{c.sent_count} / {c.total_count}</div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
             <div className="workspace">
                <div className="glass-card" style={{ maxWidth: '500px' }}>
                  <Icon name="settings" size={60} />
                  <h2 style={{ margin: '1.5rem 0' }}>Configuración de Seguridad</h2>
                  <p style={{ opacity: 0.5, marginBottom: '2rem' }}>Modificá tus credenciales de acceso al sistema.</p>
                  <button className="btn btn-primary" style={{ height: '55px', width: '100%' }} onClick={() => {
                    const nu = prompt("Nuevo Usuario:", user.username);
                    const np = prompt("Nueva Contraseña:");
                    if(nu && np) axios.put(`${API_URL}/api/users/update`, {id: user.id, username: nu, password: np}).then(() => handleLogout());
                  }}>ACTUALIZAR CREDENCIALES</button>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
