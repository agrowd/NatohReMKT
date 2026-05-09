import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

// --- ICONOS SVG PREMIUM ---
const Icon = ({ name, size = 20, color = "currentColor", onClick, style }) => {
  const icons = {
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="var(--primary)" stroke="none" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    connection: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    history: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    clip: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {icons[name] || <circle cx="12" cy="12" r="5" />}
    </svg>
  );
};

// Función Spintax Local (para el botón del ojo)
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

// --- HELPERS PARA VARIANTES ---
// Normaliza flujos antiguos a la nueva estructura de [variants]
const normalizeSteps = (steps) => {
  return steps.map(s => {
    if (s.variants) return s;
    // Si es un flow viejo, convertimos content a un array de variantes
    const content = s.content || "";
    // Si ya era un spintax manual, lo dejamos como 1 sola variante. El backend lo resolverá igual.
    return { ...s, variants: [content] };
  });
};

// Ahora las variantes viajan crudas al backend, el bot elegirá una al azar independientemente
const prepareSteps = (steps) => {
  return steps.map(step => {
    return { ...step, variants: step.variants.filter(v => v.trim() !== "") };
  });
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
  const [previews, setPreviews] = useState({});
  const fileInputRefs = useRef({});

  const [selectedLabels, setSelectedLabels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedLabels') || '[]'); } catch(e) { return []; }
  });
  
  // Nuevo Estado Inicial: Soporta 'variants' en lugar de un solo 'content'
  const [flowSteps, setFlowSteps] = useState(() => {
    try { 
      const stored = JSON.parse(localStorage.getItem('flowSteps') || '[]');
      if(stored.length > 0) return normalizeSteps(stored);
      return [{"id":1,"type":"message","variants":["¡Hola! 🚀"],"mediaPath":null}]; 
    } catch(e) { 
      return [{"id":1,"type":"message","variants":["¡Hola! 🚀"],"mediaPath":null}]; 
    }
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
    socket.on('campaign_finished', () => { 
      setActiveCampaign(null); 
      fetchCampaigns(); 
      alert('✅ ¡Campaña Finalizada! Todos los mensajes han sido enviados o procesados exitosamente.');
    });
    
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

  const startCampaign = async () => {
    if (status !== 'BOT ONLINE') return alert('Bot desconectado');
    if (selectedLabels.length === 0) return alert('Seleccioná etiquetas');
    try {
      const pSteps = prepareSteps(flowSteps); // Variantes directas al motor
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Camp. ${new Date().toLocaleTimeString()}`, steps: pSteps });
      await axios.post(`${API_URL}/api/campaigns`, { flowId: flowRes.data.id, labelIds: selectedLabels, config });
      setShowModal(true);
      alert('🚀 ¡Campaña Iniciada! El bot está procesando los contactos en segundo plano.');
    } catch (e) { alert("Error al lanzar"); }
  };

  const handleFileUpload = async (stepId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData);
      setFlowSteps(flowSteps.map(s => s.id === stepId ? { ...s, mediaPath: res.data.url, mediaName: file.name } : s));
    } catch (e) { alert("Error al subir archivo"); }
  };

  if (!user) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '3rem' }}>
          <Icon name="zap" size={60} />
          <h2 style={{ fontSize: '2rem', margin: '1.5rem 0 2rem 0', fontWeight: 800 }}>NatohReMKT</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" placeholder="Usuario" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} className="styled-input" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', textAlign: 'left' }} required />
            <input type="password" placeholder="Contraseña" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} className="styled-input" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', textAlign: 'left' }} required />
            <button type="submit" className="btn btn-primary" style={{ height: '55px', marginTop: '1rem', width: '100%' }}>ENTRAR</button>
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
        <div className={`nav-item ${activeTab === 'smart-tag' ? 'active' : ''}`} onClick={() => setActiveTab('smart-tag')} title="Smart Tagging"><Icon name="user" /></div>
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
              <div style={{ flex: 1, maxWidth: '350px', marginLeft: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800 }}>⚡ {activeCampaign.sentCount} / {activeCampaign.total}</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${(activeCampaign.sentCount / activeCampaign.total) * 100}%`, height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />
                </div>
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
                  <div key={f.id} className="label-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span onClick={() => setFlowSteps(normalizeSteps(JSON.parse(f.steps)))} style={{ cursor: 'pointer', flex: 1 }}>{f.name}</span>
                     {user.role === 'admin' && <Icon name="trash" size={12} onClick={() => { if(confirm("¿Borrar?")) axios.delete(`${API_URL}/api/flows/${f.id}`).then(fetchFlows) }} style={{ opacity: 0.3 }} />}
                  </div>
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
                    <div className="styled-input-group">
                      <label className="input-label"><Icon name="user" size={14} /> Delay entre Leads (Franja seg)</label>
                      <div className="range-container">
                        <input type="number" value={config.minLeadDelay} onChange={(e) => setConfig({...config, minLeadDelay: parseInt(e.target.value)})} className="styled-input" placeholder="MÍN" />
                        <div className="range-divider" />
                        <input type="number" value={config.maxLeadDelay} onChange={(e) => setConfig({...config, maxLeadDelay: parseInt(e.target.value)})} className="styled-input" placeholder="MÁX" />
                      </div>
                    </div>
                    <div className="styled-input-group">
                      <label className="input-label"><Icon name="message" size={14} /> Delay entre Pasos (Franja seg)</label>
                      <div className="range-container">
                        <input type="number" value={config.minStepDelay} onChange={(e) => setConfig({...config, minStepDelay: parseInt(e.target.value)})} className="styled-input" placeholder="MÍN" />
                        <div className="range-divider" />
                        <input type="number" value={config.maxStepDelay} onChange={(e) => setConfig({...config, maxStepDelay: parseInt(e.target.value)})} className="styled-input" placeholder="MÁX" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem' }}>Estrategia de Mensajes</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => { const n = prompt("Nombre:"); if(n) axios.post(`${API_URL}/api/flows`, {name: n, steps: prepareSteps(flowSteps)}).then(fetchFlows) }}><Icon name="save" size={14}/> Guardar</button>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', variants: [''], mediaPath: null }])}>+ Bloque</button>
                    </div>
                  </div>
                  
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step" style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 800, color: 'var(--primary)' }}>BLOQUE DE MENSAJE #{i+1}</span>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                          <input type="file" ref={el => fileInputRefs.current[step.id] = el} style={{ display: 'none' }} onChange={(e) => handleFileUpload(step.id, e.target.files[0])} />
                          <Icon name="clip" size={16} onClick={() => fileInputRefs.current[step.id].click()} style={{ opacity: step.mediaPath ? 1 : 0.4, color: step.mediaPath ? 'var(--primary)' : 'inherit' }} />
                          <Icon name="eye" size={16} onClick={() => { 
                             const validVars = step.variants.filter(v => v.trim() !== "");
                             const tempContent = validVars.length > 1 ? `{${validVariants.join('|')}}` : validVars[0];
                             const r = resolveSpintaxLocal(tempContent); 
                             setPreviews({...previews, [step.id]: r});
                          }} style={{ opacity: 0.4 }} />
                          <Icon name="trash" size={16} color="#ff4444" onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))} style={{ opacity: 0.4 }} />
                        </div>
                      </div>

                      {/* Renderizado de Múltiples Tarjetas de Variantes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {step.variants.map((vText, vIndex) => (
                          <div key={vIndex} style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                              <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 600, letterSpacing: '1px' }}>VARIANTE DE TEXTO {vIndex + 1}</span>
                              {step.variants.length > 1 && (
                                <Icon name="trash" size={12} color="#ff4444" onClick={() => {
                                  const newVars = [...step.variants];
                                  newVars.splice(vIndex, 1);
                                  setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, variants: newVars } : s));
                                }} style={{ opacity: 0.5 }} />
                              )}
                            </div>
                            <textarea 
                              value={vText} 
                              onChange={(e) => {
                                const newVars = [...step.variants];
                                newVars[vIndex] = e.target.value;
                                setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, variants: newVars } : s));
                              }} 
                              rows={3} 
                              className="styled-textarea" 
                              placeholder={`Escribí la variante ${vIndex + 1} del mensaje...`} 
                              style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                            />
                          </div>
                        ))}
                      </div>

                      {step.variants.length < 5 && (
                        <button className="btn" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-dim)', border: '1px dashed rgba(255,255,255,0.1)', width: '100%', marginTop: '1rem', padding: '10px' }} onClick={() => {
                          setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, variants: [...s.variants, ""] } : s));
                        }}>
                          <Icon name="plus" size={14} /> AÑADIR VARIANTE (Máx 5)
                        </button>
                      )}

                      {/* Renderizado de Archivo Adjunto */}
                      {step.mediaPath && (
                        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.05)', padding: '10px 15px', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.1)' }}>
                          <Icon name="clip" size={14} color="var(--primary)" />
                          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.mediaName || "Archivo adjunto"}</span>
                          <Icon name="trash" size={14} color="#ff4444" onClick={() => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, mediaPath: null, mediaName: null } : s))} style={{ cursor: 'pointer' }} />
                        </div>
                      )}
                      
                      {previews[step.id] && <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--primary)', padding: '12px', background: 'rgba(0,255,136,0.05)', borderRadius: '10px', border: '1px dashed var(--primary)' }}><b>Vista Previa Aleatoria:</b> {previews[step.id]}</div>}
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', height: '55px', marginTop: '1rem' }} onClick={startCampaign}>🚀 LANZAR CAMPAÑA</button>
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
                  <button className="btn" style={{ marginTop: '1.5rem', width: '100%', background: 'rgba(255,255,255,0.05)' }} onClick={() => { if(confirm("¿Cerrar sesión?")) axios.post(`${API_URL}/api/whatsapp/logout`).then(() => window.location.reload()) }}>CERRAR SESIÓN (LOGOUT)</button>
                </div>
             </div>
          )}

          {activeTab === 'history' && (
             <div className="workspace">
                <div className="glass-card">
                  <h2 style={{ marginBottom: '2rem' }}>Historial de Envíos</h2>
                  {campaigns.map(c => (
                    <div key={c.id} style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                      <div className="label-item" onClick={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.flow_name}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>{new Date(c.created_at).toLocaleString()}</div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--primary)', background: 'rgba(0,255,136,0.1)', padding: '5px 12px', borderRadius: '20px' }}>{c.sent_count} / {c.total_count}</div>
                      </div>
                      {expandedCampaign === c.id && (
                        <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '15px' }}>
                          {JSON.parse(c.steps).map((s, idx) => (
                            <div key={idx} style={{ marginBottom: '10px', fontSize: '0.85rem', background: 'var(--glass)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                              {s.content}
                              {s.mediaPath && <div style={{ marginTop: '8px', color: 'var(--primary)', fontSize: '0.7rem' }}>📎 Con archivo adjunto</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'smart-tag' && (
             <div className="workspace">
                <div className="glass-card" style={{ maxWidth: '600px' }}>
                  <Icon name="user" size={60} />
                  <h2 style={{ margin: '1.5rem 0' }}>Smart Tagging (Etiquetado Masivo)</h2>
                  <p style={{ opacity: 0.5, marginBottom: '2rem' }}>Buscá palabras clave en los nombres de tus contactos y asignales una etiqueta de forma automática.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="styled-input-group">
                      <label className="input-label">Palabra a buscar en el nombre</label>
                      <input type="text" className="styled-input" placeholder="Ej: Mayorista, Dr, Gimnasio..." id="smart-tag-query" />
                    </div>
                    
                    <div className="styled-input-group">
                      <label className="input-label">Etiqueta a asignar</label>
                      <select className="styled-input" id="smart-tag-label" style={{ appearance: 'auto' }}>
                        <option value="">Seleccioná una etiqueta...</option>
                        {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    <button className="btn btn-primary" style={{ height: '55px' }} onClick={async () => {
                      const query = document.getElementById('smart-tag-query').value;
                      const labelId = document.getElementById('smart-tag-label').value;
                      if (!query || !labelId) return alert("Completá los campos");
                      if (status !== 'BOT ONLINE') return alert("Bot desconectado");
                      
                      if (!confirm(`Se etiquetarán todos los contactos que contengan "${query}" con la etiqueta seleccionada. ¿Continuar?`)) return;
                      
                      try {
                        const res = await axios.post(`${API_URL}/api/contacts/smart-tag`, { query, labelId });
                        alert(`✅ ¡Proceso finalizado! Se etiquetaron ${res.data.successCount} de ${res.data.totalFound} contactos encontrados.`);
                      } catch (e) { alert("Error en el proceso"); }
                    }}>EJECUTAR ETIQUETADO MASIVO</button>

                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                      <h4 style={{ marginBottom: '1rem' }}>Sincronización de Base de Datos</h4>
                      <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1.5rem' }}>Esto descarga todos tus contactos a la base de datos local para que el sistema "recuerde" a todos, incluso si no aparecen en los chats recientes.</p>
                      <button className="btn" style={{ background: 'var(--glass)', color: '#fff', width: '100%' }} onClick={() => axios.post(`${API_URL}/api/contacts/sync`).then(() => alert("Sincronización iniciada en segundo plano"))}>FORZAR SINCRONIZACIÓN COMPLETA</button>
                    </div>
                  </div>
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
             <div className="workspace">
                <div className="glass-card" style={{ maxWidth: '500px' }}>
                  <Icon name="settings" size={60} />
                  <h2 style={{ margin: '1.5rem 0' }}>Configuración</h2>
                  <p style={{ opacity: 0.5, marginBottom: '2rem' }}>Usuario actual: <b>{user.username}</b></p>
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
