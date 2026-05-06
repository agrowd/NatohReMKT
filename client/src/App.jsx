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
    clip: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    magic: <path d="M15 4V2m0 12v-2M8 8H6m12 0h-2M13 13l-9 9m6-12l2 2m4 4l2 2"/>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    user: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// Función Spintax Local para previsualización
const resolveSpintaxLocal = (text) => {
  if (!text) return "";
  let loopCount = 0;
  while (text.includes('{') && text.includes('}') && loopCount < 10) {
    text = text.replace(/\{([^{}|]*\|[^{}]*)\}/g, (match, options) => {
      const choices = options.split('|');
      return choices[Math.floor(Math.random() * choices.length)];
    });
    loopCount++;
  }
  return text;
};

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('natoh_user')));
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
  const [previews, setPreviews] = useState({});

  // ESTADO PERSISTENTE CAMPAÑA
  const [selectedLabels, setSelectedLabels] = useState(() => JSON.parse(localStorage.getItem('selectedLabels') || '[]'));
  const [flowSteps, setFlowSteps] = useState(() => JSON.parse(localStorage.getItem('flowSteps') || '[{"id":1,"type":"message","content":"¡Hola! 🚀"}]'));
  const [config, setConfig] = useState(() => JSON.parse(localStorage.getItem('antiSpamConfig') || '{"minLeadDelay":30,"maxLeadDelay":90,"minStepDelay":5,"maxStepDelay":15}'));

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
    });
    socket.on('status', (s) => setStatus(s));
    socket.on('qr', (data) => { setQr(data); setStatus('ESPERANDO ESCANEO'); });
    socket.on('ready', () => { setStatus('BOT ONLINE'); setQr(null); fetchLabels(); });
    socket.on('labels', (data) => { setLabels(data || []); });
    socket.on('campaign_progress', (data) => setActiveCampaign(data));
    socket.on('campaign_finished', () => { setActiveCampaign(null); fetchCampaigns(); });
    fetchCampaigns(); fetchFlows();
    return () => { socket.off('status'); socket.off('qr'); socket.off('ready'); socket.off('labels'); socket.off('campaign_progress'); socket.off('campaign_finished'); };
  }, [user]);

  const fetchLabels = async () => {
    try { const res = await axios.get(`${API_URL}/api/labels`); setLabels(res.data || []); } catch (e) {}
  };
  const fetchCampaigns = async () => {
    try { const res = await axios.get(`${API_URL}/api/campaigns`); setCampaigns(res.data || []); } catch (e) {}
  };
  const fetchFlows = async () => {
    try { const res = await axios.get(`${API_URL}/api/flows`); setSavedFlows(res.data || []); } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/login`, loginForm);
      setUser(res.data.user);
      localStorage.setItem('natoh_user', JSON.stringify(res.data.user));
    } catch (e) { alert("Credenciales incorrectas"); }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('natoh_user');
  };

  const changeCredentials = async () => {
    const newUsername = prompt("Nuevo Usuario:", user.username);
    const newPassword = prompt("Nueva Contraseña:");
    if (!newUsername || !newPassword) return;
    try {
      await axios.put(`${API_URL}/api/users/update`, { id: user.id, username: newUsername, password: newPassword });
      alert("Credenciales actualizadas. Por favor, volvé a iniciar sesión.");
      handleLogout();
    } catch (e) { alert("Error al actualizar"); }
  };

  if (!user) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
          <div className="nav-item active" style={{ display: 'inline-flex', marginBottom: '2rem' }}><Icon name="zap" size={48} /></div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '2rem' }}>NatohReMKT</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" placeholder="Usuario" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '12px', color: '#fff' }} required />
            <input type="password" placeholder="Contraseña" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '12px', color: '#fff' }} required />
            <button type="submit" className="btn btn-primary" style={{ height: '55px', marginTop: '1rem' }}>ENTRAR AL SISTEMA</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚀</div>
            <h2>¡Campaña Lanzada!</h2>
            <p style={{ opacity: 0.6, marginBottom: '2rem' }}>El bot está procesando tus envíos.</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowModal(false)}>CONTINUAR</button>
          </div>
        </div>
      )}

      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ marginBottom: '2rem' }}><Icon name="zap" size={32} /></div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')} title="Constructor"><Icon name="home" /></div>
        <div className={`nav-item ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')} title="Conexión"><Icon name="connection" /></div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} title="Historial"><Icon name="history" /></div>
        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Configuración"><Icon name="settings" /></div>
        <div className="nav-item" onClick={handleLogout} title="Cerrar Sesión" style={{ marginTop: 'auto', color: '#ff4444' }}><Icon name="trash" /></div>
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
                  <span style={{ fontWeight: 800 }}>⚡ ENVIANDO {activeCampaign.sentCount}/{activeCampaign.total}</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${(activeCampaign.sentCount / activeCampaign.total) * 100}%`, height: '100%', background: 'var(--primary)', transition: '0.5s' }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{user.role === 'admin' ? '💎 Superadmin' : '👤 Usuario'}</div>
            {status === 'BOT ONLINE' && <button className="btn" onClick={fetchLabels} style={{ background: 'var(--glass)', color: '#fff' }}><Icon name="refresh" size={16}/> Etiquetas</button>}
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%', height: '100%' }}>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '1.2rem' }}>Flujos</h3>
                {savedFlows.map(f => (
                  <div key={f.id} className="label-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span onClick={() => setFlowSteps(JSON.parse(f.steps))} style={{ cursor: 'pointer', flex: 1 }}>{f.name}</span>
                    {user.role === 'admin' && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <span onClick={() => { const nn = prompt("Nuevo nombre:", f.name); if(nn) axios.put(`${API_URL}/api/flows/${f.id}`, {name: nn}).then(fetchFlows); }} style={{ opacity: 0.3, cursor: 'pointer' }}><Icon name="edit" size={12}/></span>
                        <span onClick={() => { if(confirm("¿Borrar?")) axios.delete(`${API_URL}/api/flows/${f.id}`).then(fetchFlows); }} style={{ opacity: 0.3, cursor: 'pointer' }}><Icon name="trash" size={12}/></span>
                      </div>
                    )}
                  </div>
                ))}
                <h3 style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', margin: '2rem 0 1.2rem 0' }}>Etiquetas</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabels.includes(l.id) ? 'active' : ''}`} onClick={() => setSelectedLabels(selectedLabels.includes(l.id) ? selectedLabels.filter(x => x !== l.id) : [...selectedLabels, l.id])}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ fontWeight: 600 }}>{l.name}</span>
                       {selectedLabels.includes(l.id) && <span style={{ color: 'var(--primary)' }}>✓</span>}
                    </div>
                  </div>
                ))}
              </aside>
              <main className="workspace">
                 <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', opacity: 0.5 }}>Delay Leads (Seg)</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                        <input type="number" value={config.minLeadDelay} onChange={(e) => setConfig({...config, minLeadDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                        <input type="number" value={config.maxLeadDelay} onChange={(e) => setConfig({...config, maxLeadDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', opacity: 0.5 }}>Delay Mensajes (Seg)</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                        <input type="number" value={config.minStepDelay} onChange={(e) => setConfig({...config, minStepDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                        <input type="number" value={config.maxStepDelay} onChange={(e) => setConfig({...config, maxStepDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem' }}>Constructor</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={saveCurrentFlow}><Icon name="save" size={16}/> Guardar</button>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', content: '', mediaPath: null }])}>+ Bloque</button>
                    </div>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>MENSAJE #{i+1}</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <span onClick={() => togglePreview(step.id, step.content)} style={{ cursor: 'pointer', opacity: 0.4 }}><Icon name="eye" size={16}/></span>
                          <span onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))} style={{ cursor: 'pointer', opacity: 0.4 }}><Icon name="trash" size={16}/></span>
                        </div>
                      </div>
                      <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} rows={3} placeholder="Texto..." />
                      {previews[step.id] && <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--primary)' }}>Vista: {previews[step.id]}</div>}
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', height: '55px' }} onClick={startCampaign}>🚀 LANZAR CAMPAÑA</button>
                </div>
              </main>
            </div>
          )}

          {activeTab === 'connection' && (
             <div className="workspace">
                <div className="glass-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
                  <Icon name="connection" size={56} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <h2>Conexión WhatsApp</h2>
                  <div style={{ display: 'flex', gap: '10px', margin: '2rem 0' }}>
                    <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/start`)} style={{ background: 'var(--primary)', color: '#000', flex: 1 }}>ENCENDER</button>
                    <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/stop`)} style={{ background: '#ff4444', color: '#fff', flex: 1 }}>APAGAR</button>
                  </div>
                  {qr && <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '20px', display: 'inline-block' }}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" /></div>}
                  {status === 'BOT ONLINE' && <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '1.5rem', borderRadius: '15px' }}>✅ BOT CONECTADO</div>}
                </div>
             </div>
          )}

          {activeTab === 'history' && (
             <div className="workspace">
                <div className="glass-card">
                  <h2>Historial</h2>
                  {campaigns.map(c => (
                    <div key={c.id} style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                      <div className="label-item" onClick={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.flow_name}</span>
                        <span>{c.sent_count}/{c.total_count} ✅</span>
                      </div>
                      {expandedCampaign === c.id && (
                        <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '10px' }}>
                          {JSON.parse(c.steps).map((s, idx) => <div key={idx} style={{ marginBottom: '5px', fontSize: '0.85rem' }}>{s.content}</div>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
             <div className="workspace">
                <div className="glass-card" style={{ maxWidth: '500px' }}>
                  <Icon name="lock" size={48} style={{ color: 'var(--primary)', marginBottom: '1.5rem' }} />
                  <h2>Seguridad del Sistema</h2>
                  <p style={{ opacity: 0.5, marginBottom: '2.5rem' }}>Cambia tus credenciales de acceso para mayor seguridad.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '15px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '5px' }}>USUARIO ACTUAL:</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{user.username}</div>
                    </div>
                    <button className="btn btn-primary" style={{ height: '55px', marginTop: '1rem' }} onClick={changeCredentials}>ACTUALIZAR CREDENCIALES</button>
                  </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
