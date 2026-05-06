import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

// --- ICONOS SVG (SIMPLIFICADOS PARA ESTABILIDAD) ---
const Icon = ({ name, size = 24 }) => {
  const icons = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    connection: <path d="M18 4l2 2-6 6M4 20l2-2 6-6" />,
    history: <circle cx="12" cy="12" r="10" />,
    trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />,
    refresh: <path d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />,
    clip: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19" />,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />,
    save: <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />,
    folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    help: <circle cx="12" cy="12" r="10" />,
    eye: <circle cx="12" cy="12" r="3" />,
    magic: <path d="M15 4V2M13 13l-9 9" />,
    lock: <rect x="3" y="11" width="18" height="11" rx="2" />,
    user: <circle cx="12" cy="7" r="4" />,
    settings: <circle cx="12" cy="12" r="3" />
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    }).catch(() => setStatus('ERROR DE CONEXIÓN'));

    socket.on('status', (s) => setStatus(s));
    socket.on('qr', (data) => { setQr(data); setStatus('ESPERANDO ESCANEO'); });
    socket.on('ready', () => { setStatus('BOT ONLINE'); setQr(null); fetchLabels(); });
    socket.on('labels', (data) => setLabels(data || []));
    socket.on('campaign_progress', (data) => setActiveCampaign(data));
    socket.on('campaign_finished', () => { setActiveCampaign(null); fetchCampaigns(); });
    
    fetchCampaigns(); 
    fetchFlows();
    
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
    } catch (e) { alert("Credenciales incorrectas"); }
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem('natoh_user'); };

  if (!user) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
          <div className="nav-item active" style={{ display: 'inline-flex', marginBottom: '2rem' }}><Icon name="zap" size={48} /></div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '2rem' }}>NatohReMKT</h2>
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
        <div className="nav-item active" style={{ marginBottom: '2rem' }}><Icon name="zap" size={32} /></div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}><Icon name="home" /></div>
        <div className={`nav-item ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')}><Icon name="connection" /></div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><Icon name="history" /></div>
        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}><Icon name="settings" /></div>
        <div className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto', color: '#ff4444' }}><Icon name="trash" /></div>
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
              <div style={{ flex: 1, maxWidth: '350px', marginLeft: '2rem', background: 'rgba(0, 255, 136, 0.05)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800 }}>ENVÍO: {activeCampaign.sentCount}/{activeCampaign.total}</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${(activeCampaign.sentCount / activeCampaign.total) * 100}%`, height: '100%', background: 'var(--primary)', transition: '0.5s' }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{user?.username} ({user?.role || 'user'})</div>
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%', height: '100%' }}>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '1.2rem' }}>Flujos</h3>
                {savedFlows.map(f => (
                  <div key={f.id} className="label-item" onClick={() => setFlowSteps(JSON.parse(f.steps))}>{f.name}</div>
                ))}
                <h3 style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', margin: '2rem 0 1.2rem 0' }}>Etiquetas</h3>
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
                      <label style={{ fontSize: '0.75rem', opacity: 0.5 }}>Delay Leads (Seg)</label>
                      <input type="number" value={config.minLeadDelay} onChange={(e) => setConfig({...config, minLeadDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', marginTop: '5px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', opacity: 0.5 }}>Delay Mensajes (Seg)</label>
                      <input type="number" value={config.minStepDelay} onChange={(e) => setConfig({...config, minStepDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', marginTop: '5px' }} />
                    </div>
                  </div>
                </div>
                <div className="glass-card">
                  <h2>Constructor</h2>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step" style={{ marginBottom: '1rem' }}>
                      <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} rows={3} placeholder="Mensaje..." style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', color: '#fff' }} />
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', height: '55px' }} onClick={() => setShowModal(true)}>🚀 LANZAR</button>
                </div>
              </main>
            </div>
          )}
          
          {activeTab === 'connection' && (
            <div className="workspace">
              <div className="glass-card" style={{ textAlign: 'center', maxWidth: '400px' }}>
                <Icon name="connection" size={48} />
                <h2>Conexión</h2>
                <div style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
                   <button className="btn btn-primary" onClick={() => axios.post(`${API_URL}/api/whatsapp/start`)}>ENCENDER</button>
                   <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/stop`)}>APAGAR</button>
                </div>
                {qr && <div style={{ background: '#fff', padding: '10px', borderRadius: '10px' }}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`} alt="QR" /></div>}
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
                    <span>{c.sent_count}/{c.total_count} ✅</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="workspace">
              <div className="glass-card" style={{ maxWidth: '400px' }}>
                <Icon name="lock" size={48} />
                <h2>Seguridad</h2>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => {
                  const nu = prompt("Nuevo Usuario:", user.username);
                  const np = prompt("Nueva Pass:");
                  if(nu && np) axios.put(`${API_URL}/api/users/update`, {id: user.id, username: nu, password: np}).then(() => handleLogout());
                }}>CAMBIAR CLAVES</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
