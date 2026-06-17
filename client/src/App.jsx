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
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>
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
  const [isSyncingLabels, setIsSyncingLabels] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  const [campaigns, setCampaigns] = useState([]);
  const [savedFlows, setSavedFlows] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [tagProgress, setTagProgress] = useState(null);
  const [previews, setPreviews] = useState({});
  const [importFile, setImportFile] = useState(null);
  const fileInputRefs = useRef({});

  // --- ESTADOS DE BÚSQUEDA INTELIGENTE (ESCENARIO B) ---
  const [searchWord, setSearchWord] = useState('');
  const [searchChatsLimit, setSearchChatsLimit] = useState(100);
  const [searchMsgsLimit, setSearchMsgsLimit] = useState(50);
  const [searchProgress, setSearchProgress] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSelectedLabel, setSearchSelectedLabel] = useState('');
  const [bulkTagProgress, setBulkTagProgress] = useState(null);
  const [isBulkTagging, setIsBulkTagging] = useState(false);
  const [expandedChats, setExpandedChats] = useState({});
  const [quickSendTexts, setQuickSendTexts] = useState({});
  const [quickTagLabels, setQuickTagLabels] = useState({});

  const [selectedLabels, setSelectedLabels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedLabels') || '[]'); } catch(e) { return []; }
  });
  const [virtualLists, setVirtualLists] = useState([]);
  const [selectedVirtualLists, setSelectedVirtualLists] = useState([]);
  
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
      if (res.data.activeSearch && res.data.activeSearch.status === 'running') {
        setIsSearching(true);
        setSearchWord(res.data.activeSearch.query);
      }
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
    
    socket.on('tag_progress', (data) => {
      setTagProgress(data);
      if (data.status === 'finished') {
        alert(`✅ ¡Etiquetado finalizado! Se procesaron ${data.current} contactos.`);
        setTagProgress(null);
      }
    });

    socket.on('search_status', (data) => {
      if (data.status === 'running') {
        setIsSearching(true);
        setSearchProgress({ current: data.current, total: data.total, matches: 0 });
      } else if (data.status === 'finished') {
        setIsSearching(false);
        setSearchProgress(null);
        alert(`🔍 ¡Búsqueda finalizada! Se encontraron ${data.matches} chats con coincidencias.`);
      } else if (data.status === 'cancelled') {
        setIsSearching(false);
        setSearchProgress(null);
        alert('🔍 Búsqueda cancelada.');
      } else if (data.status === 'error') {
        setIsSearching(false);
        setSearchProgress(null);
        alert(`❌ Error en búsqueda: ${data.error}`);
      }
    });

    socket.on('search_progress', (data) => {
      setSearchProgress(data);
    });

    socket.on('search_match', (match) => {
      setSearchResults(prev => {
        if (prev.some(x => x.id === match.id)) return prev;
        return [...prev, match];
      });
    });

    socket.on('bulk_tag_progress', (data) => {
      setBulkTagProgress(data);
      setIsBulkTagging(data.status === 'running');
      if (data.status === 'finished') {
        alert(`🏷️ ¡Etiquetado masivo finalizado! Se procesaron ${data.current} de ${data.total} chats.`);
        setBulkTagProgress(null);
        setIsBulkTagging(false);
        fetchLabels();
      }
    });
    
    fetchCampaigns(); fetchFlows(); fetchVirtualLists();
    return () => { 
      socket.off('status'); 
      socket.off('qr'); 
      socket.off('ready'); 
      socket.off('labels'); 
      socket.off('campaign_progress'); 
      socket.off('campaign_finished'); 
      socket.off('tag_progress'); 
      socket.off('search_status'); 
      socket.off('search_progress'); 
      socket.off('search_match'); 
      socket.off('bulk_tag_progress'); 
    };
}, [user]);

  const fetchLabels = async (sync = false) => { 
    try { 
      if (sync) setIsSyncingLabels(true);
      const res = await axios.get(`${API_URL}/api/labels${sync ? '?sync=true' : ''}`); 
      setLabels(res.data || []); 
    } catch (e) {
      console.error(e);
    } finally {
      if (sync) setIsSyncingLabels(false);
    }
  };
  const fetchVirtualLists = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/virtual-lists`);
      setVirtualLists(res.data || []);
    } catch (e) {}
  };
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
    if (selectedLabels.length === 0 && selectedVirtualLists.length === 0) return alert('Seleccioná al menos una etiqueta nativa o una lista virtual');
    try {
      const pSteps = prepareSteps(flowSteps); // Variantes directas al motor
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Camp. ${new Date().toLocaleTimeString()}`, steps: pSteps });
      await axios.post(`${API_URL}/api/campaigns`, { 
        flowId: flowRes.data.id, 
        labelIds: selectedLabels, 
        virtualListIds: selectedVirtualLists, 
        config 
      });
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
        <div className={`nav-item ${activeTab === 'vcf-import' ? 'active' : ''}`} onClick={() => setActiveTab('vcf-import')} title="Importador VCF/CSV"><Icon name="clip" /></div>
        <div className={`nav-item ${activeTab === 'smart-search' ? 'active' : ''}`} onClick={() => setActiveTab('smart-search')} title="Buscador Mensajes"><Icon name="search" /></div>
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
              {status === 'BOT ONLINE' && (
                <button 
                  className="btn" 
                  onClick={() => fetchLabels(true)} 
                  disabled={isSyncingLabels}
                  style={{ background: 'var(--glass)', color: '#fff', opacity: isSyncingLabels ? 0.7 : 1 }}
                >
                  <Icon 
                    name="refresh" 
                    size={16} 
                    className={isSyncingLabels ? "spin-animation" : ""}
                  /> 
                  {isSyncingLabels ? 'Sincronizando...' : 'Sincronizar'}
                </button>
              )}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span>{l.name}</span>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', opacity: 0.6 }}>{l.memberCount || 0}</span>
                    </div>
                  </div>
                ))}

                <h3 className="section-title" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Listas Virtuales</span>
                  <button className="btn" style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={async () => {
                    const name = prompt("Nombre de la nueva lista virtual:");
                    if (!name) return;
                    try {
                      await axios.post(`${API_URL}/api/virtual-lists`, { name });
                      fetchVirtualLists();
                    } catch (e) {
                      alert("Error al crear lista virtual");
                    }
                  }}>
                    + NUEVA
                  </button>
                </h3>
                {virtualLists.map(vl => (
                  <div key={vl.id} className={`label-item ${selectedVirtualLists.includes(vl.id) ? 'active' : ''}`} style={{ borderColor: vl.color || 'var(--primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span onClick={() => setSelectedVirtualLists(selectedVirtualLists.includes(vl.id) ? selectedVirtualLists.filter(x => x !== vl.id) : [...selectedVirtualLists, vl.id])} style={{ flex: 1, cursor: 'pointer' }}>
                        📁 {vl.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', opacity: 0.6 }}>{vl.memberCount || 0}</span>
                        {user.role === 'admin' && (
                          <Icon name="trash" size={12} onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`¿Borrar la lista virtual "${vl.name}"?`)) {
                              try {
                                await axios.delete(`${API_URL}/api/virtual-lists/${vl.id}`);
                                setSelectedVirtualLists(selectedVirtualLists.filter(x => x !== vl.id));
                                fetchVirtualLists();
                              } catch(e) {
                                alert("Error al borrar lista virtual");
                              }
                            }
                          }} style={{ opacity: 0.3, cursor: 'pointer' }} />
                        )}
                      </div>
                    </div>
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
                  <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div className="styled-input-group">
                      <label className="input-label"><Icon name="zap" size={14} /> Límite de envíos (Lote)</label>
                      <input type="number" value={config.batchLimit || ''} onChange={(e) => setConfig({...config, batchLimit: parseInt(e.target.value)})} className="styled-input" placeholder="Ej: 50 (Vacio = Todos)" />
                      <p style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '5px' }}>Ideal para enviar de a 50 leads por día.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" id="auto-remove" checked={config.autoRemove || false} onChange={(e) => setConfig({...config, autoRemove: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <label htmlFor="auto-remove" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>Quitar de la etiqueta al enviar</label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" id="exclude-ever" checked={config.excludeEver || false} onChange={(e) => setConfig({...config, excludeEver: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <label htmlFor="exclude-ever" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', color: 'var(--primary)' }}><b>Memoria Infinita:</b> No enviar si ya se le envió antes</label>
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
                        {labels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.memberCount || 0})</option>)}
                      </select>
                    </div>

                    <div className="styled-input-group">
                      <label className="input-label">Límite de personas a etiquetar</label>
                      <input type="number" className="styled-input" defaultValue="200" id="smart-tag-limit" />
                      <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '5px' }}>Se recomienda no superar los 250 por lote para mayor seguridad.</p>
                    </div>

                    <button className="btn btn-primary" style={{ height: '55px' }} disabled={tagProgress?.status === 'running'} onClick={async () => {
                      const query = document.getElementById('smart-tag-query').value;
                      const labelId = document.getElementById('smart-tag-label').value;
                      const limit = parseInt(document.getElementById('smart-tag-limit').value);
                      if (!query || !labelId) return alert("Completá los campos");
                      if (status !== 'BOT ONLINE') return alert("Bot desconectado");
                      
                      if (!confirm(`Se etiquetarán un máximo de ${limit} contactos que contengan "${query}". ¿Continuar?`)) return;
                      
                      try {
                        await axios.post(`${API_URL}/api/contacts/smart-tag`, { query, labelId, limit });
                        // El feedback vendrá por Socket
                      } catch (e) { alert("Error al iniciar el proceso"); }
                    }}>
                      {tagProgress?.status === 'running' ? 'PROCESANDO...' : 'EJECUTAR ETIQUETADO MASIVO'}
                    </button>

                    {tagProgress && (
                      <div style={{ marginTop: '1rem', background: 'rgba(0,255,136,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(0,255,136,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 800 }}>Etiquetando: {tagProgress.current} / {tagProgress.total}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{ width: `${(tagProgress.current / tagProgress.total) * 100}%`, height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />
                        </div>
                      </div>
                    )}


                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                      <h4 style={{ marginBottom: '1rem' }}>Sincronización de Base de Datos</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '1rem' }}>Sincroniza nombres y números de todos tus contactos.</p>
                          <button className="btn" style={{ background: 'var(--glass)', color: '#fff', width: '100%', fontSize: '0.8rem' }} onClick={() => axios.post(`${API_URL}/api/contacts/sync`).then(() => alert("Sincronización de agenda iniciada"))}>SINC. CONTACTOS</button>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '1rem' }}>Escanea todas las etiquetas para detectar a TODOS sus miembros.</p>
                          <button className="btn" style={{ background: 'var(--glass)', color: '#fff', width: '100%', fontSize: '0.8rem' }} onClick={() => axios.post(`${API_URL}/api/contacts/deep-sync`).then(() => alert("Sincronización profunda de etiquetas iniciada"))}>SINC. PROFUNDA ETIQUETAS</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
             </div>
          )}


          {activeTab === 'smart-search' && (
             <div className="workspace" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem', width: '100%', height: '100%' }}>
                <div className="glass-card" style={{ height: 'fit-content' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                    <Icon name="search" size={28} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Smart Message Search</h2>
                  </div>
                  <p style={{ opacity: 0.5, fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                    Busca términos clave dentro del historial de tus chats y aplica etiquetas masivas a quienes lo mencionaron.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div className="styled-input-group">
                      <label className="input-label">Palabra clave (Término a buscar)</label>
                      <input 
                        type="text" 
                        className="styled-input" 
                        placeholder="Ej: presupuesto, precio, info..." 
                        value={searchWord}
                        onChange={(e) => setSearchWord(e.target.value)}
                        disabled={isSearching}
                      />
                    </div>
                    
                    <div className="styled-input-group">
                      <label className="input-label">Cantidad de Chats a Analizar</label>
                      <select 
                        className="styled-input" 
                        style={{ appearance: 'auto' }}
                        value={searchChatsLimit}
                        onChange={(e) => setSearchChatsLimit(e.target.value)}
                        disabled={isSearching}
                      >
                        <option value="50">Últimos 50 chats activos</option>
                        <option value="100">Últimos 100 chats activos</option>
                        <option value="250">Últimos 250 chats activos</option>
                        <option value="500">Últimos 500 chats activos</option>
                        <option value="all">Escanear TODOS los chats</option>
                      </select>
                    </div>

                    <div className="styled-input-group">
                      <label className="input-label">Profundidad (Mensajes por Chat)</label>
                      <select 
                        className="styled-input" 
                        style={{ appearance: 'auto' }}
                        value={searchMsgsLimit}
                        onChange={(e) => setSearchMsgsLimit(e.target.value)}
                        disabled={isSearching}
                      >
                        <option value="20">Últimos 20 mensajes</option>
                        <option value="50">Últimos 50 mensajes</option>
                        <option value="100">Últimos 100 mensajes</option>
                        <option value="200">Últimos 200 mensajes</option>
                      </select>
                    </div>

                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '10px' }}>
                      {!isSearching ? (
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, height: '48px' }} 
                          onClick={async () => {
                            if (!searchWord.trim()) return alert("Ingresá una palabra clave a buscar.");
                            if (status !== 'BOT ONLINE') return alert("El bot debe estar encendido para buscar.");
                            setSearchResults([]);
                            try {
                              await axios.post(`${API_URL}/api/whatsapp/search-messages`, {
                                query: searchWord,
                                chatLimit: searchChatsLimit,
                                messageLimit: searchMsgsLimit
                              });
                              setIsSearching(true);
                            } catch (e) { alert("Error al iniciar búsqueda."); }
                          }}
                        >
                          🔍 INICIAR BÚSQUEDA
                        </button>
                      ) : (
                        <button 
                          className="btn" 
                          style={{ flex: 1, height: '48px', background: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)' }} 
                          onClick={async () => {
                            try {
                              await axios.post(`${API_URL}/api/whatsapp/cancel-search`);
                            } catch (e) {}
                          }}
                        >
                          ⏹️ CANCELAR BÚSQUEDA
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {searchProgress && (
                    <div className="glass-card" style={{ background: 'rgba(0,255,136,0.02)', border: '1px solid rgba(0,255,136,0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 800 }}>Escaneando: {searchProgress.current} / {searchProgress.total} chats</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{searchProgress.matches || 0} Coincidencias</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${(searchProgress.current / searchProgress.total) * 100}%`, 
                            height: '100%', 
                            background: 'var(--primary)', 
                            boxShadow: '0 0 10px var(--primary)', 
                            transition: 'width 0.3s ease' 
                          }} 
                        />
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem', gap: '1rem', background: 'rgba(255, 255, 255, 0.03)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)' }}>🏷️ ETIQUETADO MASIVO</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Asigna etiqueta a los {searchResults.length} chats coincidentes</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '400px', alignItems: 'center' }}>
                        <select 
                          className="styled-input" 
                          style={{ appearance: 'auto', margin: 0, height: '40px' }}
                          value={searchSelectedLabel}
                          onChange={(e) => setSearchSelectedLabel(e.target.value)}
                          disabled={isBulkTagging}
                        >
                          <option value="">Selecciona etiqueta...</option>
                          {labels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.memberCount || 0})</option>)}
                        </select>
                        <button 
                          className="btn btn-primary" 
                          style={{ height: '40px', padding: '0 20px', whiteSpace: 'nowrap', opacity: searchSelectedLabel ? 1 : 0.5 }}
                          disabled={!searchSelectedLabel || isBulkTagging}
                          onClick={async () => {
                            if (!searchSelectedLabel) return;
                            if (!confirm(`Se asignará esta etiqueta a ${searchResults.length} chats. ¿Continuar?`)) return;
                            try {
                              setIsBulkTagging(true);
                              await axios.post(`${API_URL}/api/whatsapp/bulk-tag`, {
                                chatIds: searchResults.map(r => r.id),
                                labelId: searchSelectedLabel
                              });
                            } catch (e) {
                              setIsBulkTagging(false);
                              alert("Error al iniciar el etiquetado masivo.");
                            }
                          }}
                        >
                          {isBulkTagging ? 'ETIQUETANDO...' : 'ETIQUETAR TODOS'}
                        </button>
                      </div>
                    </div>
                  )}

                  {bulkTagProgress && (
                    <div className="glass-card" style={{ background: 'rgba(0, 255, 136, 0.05)', border: '1px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 800 }}>Etiquetando masivamente: {bulkTagProgress.current} / {bulkTagProgress.total}</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${(bulkTagProgress.current / bulkTagProgress.total) * 100}%`, 
                            height: '100%', 
                            background: 'var(--primary)', 
                            boxShadow: '0 0 10px var(--primary)' 
                          }} 
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {searchResults.length === 0 ? (
                      <div style={{ textAlign: 'center', opacity: 0.4, padding: '4rem 1rem' }}>
                        <Icon name="search" size={50} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>{isSearching ? 'Buscando coincidencias en los mensajes...' : 'No hay búsquedas activas. Introduce un término para buscar.'}</p>
                      </div>
                    ) : (
                      searchResults.map((chat) => (
                        <div 
                          key={chat.id} 
                          className="glass-card" 
                          style={{ 
                            padding: '1.2rem', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: expandedChats[chat.id] ? '1px solid rgba(0, 255, 136, 0.2)' : '1px solid var(--glass-border)',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setExpandedChats({...expandedChats, [chat.id]: !expandedChats[chat.id]})}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <div 
                                style={{ 
                                  width: '42px', 
                                  height: '42px', 
                                  borderRadius: '50%', 
                                  background: 'linear-gradient(135deg, var(--primary) 0%, #0099ff 100%)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontWeight: 800,
                                  fontSize: '0.9rem',
                                  color: '#fff',
                                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                              >
                                {chat.name ? chat.name.slice(0, 2).toUpperCase() : 'WA'}
                              </div>
                              <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{chat.name || 'Usuario WhatsApp'}</h3>
                                <p style={{ fontSize: '0.7rem', opacity: 0.4, margin: '2px 0 0 0' }}>ID: {chat.id}</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span 
                                style={{ 
                                  fontSize: '0.75rem', 
                                  fontWeight: 800, 
                                  color: 'var(--primary)', 
                                  background: 'rgba(0, 255, 136, 0.08)', 
                                  padding: '4px 10px', 
                                  borderRadius: '20px',
                                  border: '1px solid rgba(0, 255, 136, 0.15)'
                                }}
                              >
                                {chat.matchCount} {chat.matchCount === 1 ? 'coincidencia' : 'coincidencias'}
                              </span>
                              <span style={{ transform: expandedChats[chat.id] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.5 }}>▼</span>
                            </div>
                          </div>

                          {expandedChats[chat.id] && (
                            <div style={{ marginTop: '1.2rem', paddingTop: '1.2rem', borderTop: '1px solid var(--glass-border)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
                                {chat.messages.map((m, idx) => (
                                  <div 
                                    key={idx} 
                                    style={{ 
                                      background: m.fromMe ? 'rgba(0, 255, 136, 0.03)' : 'rgba(255, 255, 255, 0.01)', 
                                      padding: '10px 15px', 
                                      borderRadius: '10px', 
                                      border: m.fromMe ? '1px solid rgba(0, 255, 136, 0.1)' : '1px solid rgba(255,255,255,0.03)',
                                      marginLeft: m.fromMe ? '2rem' : '0',
                                      marginRight: m.fromMe ? '0' : '2rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', opacity: 0.5, marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 800 }}>{m.fromMe ? 'Tú' : 'Contacto'}</span>
                                      <span>{new Date(m.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{m.body}</p>
                                  </div>
                                ))}
                              </div>

                              <div 
                                style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: '1fr 220px', 
                                  gap: '1rem', 
                                  background: 'rgba(0,0,0,0.1)', 
                                  padding: '1rem', 
                                  borderRadius: '12px', 
                                  border: '1px solid rgba(255,255,255,0.02)' 
                                }}
                              >
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <input 
                                    type="text" 
                                    className="styled-input" 
                                    placeholder="Redactar respuesta rápida..." 
                                    style={{ margin: 0, height: '40px', fontSize: '0.8rem' }}
                                    value={quickSendTexts[chat.id] || ''}
                                    onChange={(e) => setQuickSendTexts({...quickSendTexts, [chat.id]: e.target.value})}
                                  />
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ height: '40px', padding: '0 15px', fontSize: '0.8rem' }}
                                    onClick={async () => {
                                      const text = quickSendTexts[chat.id];
                                      if (!text || !text.trim()) return;
                                      try {
                                        await axios.post(`${API_URL}/api/whatsapp/send-direct`, {
                                          to: chat.id,
                                          content: text
                                        });
                                        setQuickSendTexts({...quickSendTexts, [chat.id]: ''});
                                        alert("✉️ Mensaje enviado con éxito.");
                                      } catch (e) { alert("Error al enviar mensaje."); }
                                    }}
                                  >
                                    Enviar
                                  </button>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <select 
                                    className="styled-input" 
                                    style={{ appearance: 'auto', margin: 0, height: '40px', fontSize: '0.8rem', flex: 1 }}
                                    value={quickTagLabels[chat.id] || ''}
                                    onChange={(e) => setQuickTagLabels({...quickTagLabels, [chat.id]: e.target.value})}
                                  >
                                    <option value="">Etiquetar...</option>
                                    {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                  </select>
                                  <button 
                                    className="btn" 
                                    style={{ height: '40px', padding: '0 12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', fontSize: '0.8rem' }}
                                    onClick={async () => {
                                      const labelId = quickTagLabels[chat.id];
                                      if (!labelId) return;
                                      try {
                                        await axios.post(`${API_URL}/api/whatsapp/bulk-tag`, {
                                          chatIds: [chat.id],
                                          labelId: labelId
                                        });
                                        alert("🏷️ Contacto etiquetado.");
                                        fetchLabels();
                                      } catch (e) { alert("Error al etiquetar."); }
                                    }}
                                  >
                                    OK
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
             </div>
          )}

          {activeTab === 'vcf-import' && (
             <div className="workspace">
                <div className="glass-card" style={{ maxWidth: '650px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1.5rem' }}>
                    <Icon name="clip" size={40} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.6rem', margin: 0 }}>Importador de Agenda (VCF / CSV)</h2>
                  </div>
                  <p style={{ opacity: 0.7, fontSize: '0.9rem', marginBottom: '2.5rem', lineHeight: '1.6' }}>
                    Carga el archivo de contactos de tu celular para segmentarlo y crear listas de remarketing virtuales. El sistema normaliza automáticamente los teléfonos y previene envíos duplicados.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Paso 1: Seleccionar Archivo */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '15px', border: '2px dashed var(--glass-border)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>1. Sube tu archivo de agenda</span>
                      <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: '0 0 10px 0' }}>Formatos soportados: vCard (.vcf) o Google Contacts (.csv)</p>
                      <input 
                        type="file" 
                        accept=".vcf,.csv" 
                        id="vcf-tab-file-input" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) setImportFile(file);
                        }}
                      />
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '12px 24px', fontSize: '0.85rem' }}
                        onClick={() => document.getElementById('vcf-tab-file-input').click()}
                      >
                        {importFile ? '📂 CAMBIAR ARCHIVO' : '📁 SELECCIONAR ARCHIVO'}
                      </button>
                      {importFile && (
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold', background: 'rgba(0,255,136,0.05)', padding: '6px 15px', borderRadius: '20px' }}>
                          ✓ {importFile.name} ({Math.round(importFile.size / 1024)} KB)
                        </div>
                      )}
                    </div>

                    {/* Paso 2: Configurar la Lista Virtual */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'rgba(255,255,255,0.01)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <div className="styled-input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: 700 }}>2a. Crear NUEVA Lista Virtual</label>
                        <input type="text" className="styled-input" id="vcf-tab-list-name" placeholder="Ej: Clientes Luz Pulsada" style={{ background: 'rgba(0,0,0,0.2)' }} />
                      </div>
                      
                      <div className="styled-input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: 700 }}>2b. O usar una lista existente</label>
                        <select className="styled-input" id="vcf-tab-list-id" style={{ appearance: 'auto', background: 'rgba(0,0,0,0.2)' }}>
                          <option value="">-- Seleccionar lista --</option>
                          {virtualLists.map(vl => <option key={vl.id} value={vl.id}>{vl.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Paso 3: Filtrar por Nombre */}
                    <div className="styled-input-group" style={{ background: 'rgba(255,255,255,0.01)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <label className="input-label" style={{ fontWeight: 700 }}>3. Filtrar por palabra clave en el Nombre (Opcional)</label>
                      <input type="text" className="styled-input" id="vcf-tab-filter" placeholder="Ej: luz pulsada" style={{ background: 'rgba(0,0,0,0.2)' }} />
                      <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '8px', lineHeight: '1.4' }}>
                        💡 <strong>Ejemplo de uso:</strong> Si tu archivo contiene a todos tus contactos pero solo quieres agrupar a los que dicen "Luz Pulsada", escribe "luz pulsada" aquí. Solo se importarán esos contactos. Dejar en blanco para importar todo.
                      </p>
                    </div>

                    {/* Paso 4: Control Anti-Spam */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0, 255, 136, 0.03)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(0, 255, 136, 0.15)' }}>
                      <input type="checkbox" id="vcf-tab-exclude-sent" defaultChecked style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                      <label htmlFor="vcf-tab-exclude-sent" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', lineHeight: '1.4' }}>
                        <strong>Exclusión Inteligente de Envío (Doble Check)</strong><br/>
                        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>No agregar a la lista a ningún cliente que ya haya recibido mensajes en campañas anteriores.</span>
                      </label>
                    </div>

                    {/* Botón de Ejecución */}
                    <button 
                      id="btn-vcf-import-run"
                      className="btn btn-primary" 
                      style={{ height: '55px', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.5px' }}
                      onClick={async () => {
                        if (!importFile) return alert("Por favor, selecciona un archivo (.vcf o .csv) primero.");
                        
                        const listName = document.getElementById('vcf-tab-list-name').value;
                        const listId = document.getElementById('vcf-tab-list-id').value;
                        const filterQuery = document.getElementById('vcf-tab-filter').value;
                        const excludeSent = document.getElementById('vcf-tab-exclude-sent').checked;
                        
                        if (!listName && !listId) {
                          return alert("Por favor, ingresa el nombre para la nueva lista o selecciona una lista existente.");
                        }
                        
                        const formData = new FormData();
                        formData.append('file', importFile);
                        if (listName) formData.append('listName', listName);
                        if (listId) formData.append('listId', listId);
                        if (filterQuery) formData.append('filterQuery', filterQuery);
                        formData.append('excludeSent', excludeSent ? 'true' : 'false');
                        
                        try {
                          const btn = document.getElementById('btn-vcf-import-run');
                          btn.innerText = "IMPORTANDO Y FILTRANDO CONTACTOS...";
                          btn.disabled = true;
                          
                          const res = await axios.post(`${API_URL}/api/contacts/import-vcf`, formData);
                          
                          alert(`🎉 ¡Proceso Finalizado con éxito!\n\n` +
                                `• Total contactos en el archivo: ${res.data.parsedCount}\n` +
                                `• Contactos agregados al sistema: ${res.data.insertedPhoneNumbers}\n` +
                                `• Asociados a la lista "${res.data.listName || 'seleccionada'}": ${res.data.associatedCount}\n` +
                                `• Omitidos por mensaje ya enviado (Anti-Spam): ${res.data.skippedCount}`);
                          
                          fetchVirtualLists();
                          setImportFile(null);
                          document.getElementById('vcf-tab-file-input').value = "";
                          document.getElementById('vcf-tab-list-name').value = "";
                          document.getElementById('vcf-tab-filter').value = "";
                        } catch(err) {
                          alert(`❌ Error al importar: ${err.response?.data?.error || err.message}`);
                        } finally {
                          const btn = document.getElementById('btn-vcf-import-run');
                          btn.innerText = "IMPORTAR Y CREAR LISTA";
                          btn.disabled = false;
                        }
                      }}
                    >
                      IMPORTAR Y CREAR LISTA
                    </button>
                    
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
