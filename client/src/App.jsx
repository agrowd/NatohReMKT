import React, { useState, useEffect, useRef } from 'react';
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
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

function App() {
  const [status, setStatus] = useState('VERIFICANDO...');
  const [qr, setQr] = useState(null);
  const [labels, setLabels] = useState([]);
  const [activeTab, setActiveTab] = useState('builder');
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);

  // PERSISTENCIA
  const [selectedLabels, setSelectedLabels] = useState(() => JSON.parse(localStorage.getItem('selectedLabels') || '[]'));
  const [flowSteps, setFlowSteps] = useState(() => JSON.parse(localStorage.getItem('flowSteps') || '[{"id":1,"type":"message","content":"¡Hola! 🚀"}]'));
  const [config, setConfig] = useState(() => JSON.parse(localStorage.getItem('antiSpamConfig') || '{"minLeadDelay":30,"maxLeadDelay":90,"minStepDelay":5,"maxStepDelay":15}'));

  useEffect(() => {
    localStorage.setItem('selectedLabels', JSON.stringify(selectedLabels));
    localStorage.setItem('flowSteps', JSON.stringify(flowSteps));
    localStorage.setItem('antiSpamConfig', JSON.stringify(config));
  }, [selectedLabels, flowSteps, config]);

  useEffect(() => {
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
    fetchCampaigns();
    return () => { socket.off('status'); socket.off('qr'); socket.off('ready'); socket.off('labels'); socket.off('campaign_progress'); socket.off('campaign_finished'); };
  }, []);

  const fetchLabels = async () => {
    try { const res = await axios.get(`${API_URL}/api/labels`); setLabels(res.data || []); } catch (e) {}
  };

  const fetchCampaigns = async () => {
    try { const res = await axios.get(`${API_URL}/api/campaigns`); setCampaigns(res.data || []); } catch (e) {}
  };

  const handleFileUpload = async (stepId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData);
      setFlowSteps(flowSteps.map(s => s.id === stepId ? { ...s, mediaPath: res.data.url, mediaFilename: res.data.filename } : s));
    } catch (e) { alert("Error al subir archivo"); }
  };

  const startCampaign = async () => {
    if (status !== 'BOT ONLINE') return alert('Bot desconectado');
    if (selectedLabels.length === 0) return alert('Seleccioná al menos una etiqueta');
    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Camp. ${new Date().toLocaleTimeString()}`, steps: flowSteps });
      await axios.post(`${API_URL}/api/campaigns`, { flowId: flowRes.data.id, labelIds: selectedLabels, config });
    } catch (e) { alert("Error"); }
  };

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ marginBottom: '2rem' }}><Icon name="zap" size={32} /></div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')} title="Constructor"><Icon name="home" /></div>
        <div className={`nav-item ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')} title="Conexión"><Icon name="connection" /></div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} title="Historial"><Icon name="history" /></div>
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
                  <span style={{ fontWeight: 800 }}>⚡ ENVIANDO</span>
                  <span>{activeCampaign.sentCount} / {activeCampaign.total}</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${(activeCampaign.sentCount / activeCampaign.total) * 100}%`, height: '100%', background: 'var(--primary)', transition: '0.5s' }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {status === 'BOT ONLINE' && <button className="btn" onClick={fetchLabels} style={{ background: 'var(--glass)', color: '#fff' }}><Icon name="refresh" size={16}/> Etiquetas</button>}
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%', height: '100%' }}>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '1.5rem' }}>Etiquetas</h3>
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
                {/* Anti-Spam Config */}
                <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', opacity: 0.5 }}>Delay entre Leads (Segundos)</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                        <input type="number" value={config.minLeadDelay} onChange={(e) => setConfig({...config, minLeadDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                        <input type="number" value={config.maxLeadDelay} onChange={(e) => setConfig({...config, maxLeadDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', opacity: 0.5 }}>Delay entre Mensajes (Segundos)</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                        <input type="number" value={config.minStepDelay} onChange={(e) => setConfig({...config, minStepDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                        <input type="number" value={config.maxStepDelay} onChange={(e) => setConfig({...config, maxStepDelay: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Message Builder */}
                <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Constructor Multimedia</h2>
                    <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => setFlowSteps([...flowSteps, { id: Date.now(), type: 'message', content: '', mediaPath: null }])}>+ Bloque</button>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.5, marginBottom: '0.8rem' }}>
                        <span>MENSAJE #{i+1}</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <label style={{ cursor: 'pointer', color: step.mediaPath ? 'var(--primary)' : '#fff' }} title="Adjuntar Imagen/Video/Audio">
                             <Icon name="clip" size={16} />
                             <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(step.id, e.target.files[0])} />
                          </label>
                          <span style={{ cursor: 'pointer' }} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))}><Icon name="trash" size={16}/></span>
                        </div>
                      </div>
                      <textarea value={step.content} onChange={(e) => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, content: e.target.value } : s))} rows={3} placeholder="Escribí el texto aquí..." />
                      {step.mediaPath && (
                        <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,255,136,0.05)', borderRadius: '8px', border: '1px dashed var(--primary)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icon name="zap" size={12} style={{ color: 'var(--primary)' }} />
                          <span style={{ color: 'var(--primary)' }}>Adjunto listo: {step.mediaFilename}</span>
                          <span style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setFlowSteps(flowSteps.map(s => s.id === step.id ? { ...s, mediaPath: null, mediaFilename: null } : s))}>❌</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', height: '55px' }} onClick={startCampaign}>🚀 LANZAR CAMPAÑA MULTIMEDIA</button>
                </div>

                {/* Usage Help */}
                <div className="glass-card" style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', opacity: 0.6 }}>
                    <Icon name="help" size={18} />
                    <h3 style={{ margin: 0, fontSize: '0.9rem' }}>Tips de Uso y Spintax</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', fontSize: '0.8rem', opacity: 0.5 }}>
                    <div>
                      <p style={{ fontWeight: 700, marginBottom: '5px', color: '#fff' }}>🔄 Variar Mensajes (Spintax)</p>
                      <p>Usá llaves y barras para que el bot elija una opción al azar:</p>
                      <code style={{ background: '#000', padding: '4px', borderRadius: '4px', display: 'block', marginTop: '5px' }}>
                        {"{Hola|Buen día|Buenas}"} ¿cómo estás?
                      </code>
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, marginBottom: '5px', color: '#fff' }}>📎 Multimedia</p>
                      <p>Si adjuntás un archivo, el texto del bloque se enviará como "pie" (caption) de la imagen o video automáticamente.</p>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          )}

          {activeTab === 'connection' && (
             <div className="workspace">
                <div className="glass-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
                  <Icon name="connection" size={56} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <h2>Control del Bot</h2>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '2rem 0' }}>
                    <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/start`)} style={{ background: 'var(--primary)', color: '#000', flex: 1, justifyContent: 'center' }}>ENCENDER</button>
                    <button className="btn" onClick={() => axios.post(`${API_URL}/api/whatsapp/stop`)} style={{ background: '#ff4444', color: '#fff', flex: 1, justifyContent: 'center' }}>APAGAR</button>
                  </div>
                  <button className="btn" onClick={() => { if(confirm("¿Borrar sesión?")) axios.post(`${API_URL}/api/whatsapp/logout`) }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', justifyContent: 'center', marginBottom: '2rem' }}>CERRAR SESIÓN</button>
                  {qr && <div style={{ background: '#fff', padding: '2rem', borderRadius: '30px', display: 'inline-block' }}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" /></div>}
                  {status === 'BOT ONLINE' && <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--primary)' }}><h3 style={{ color: 'var(--primary)', margin: 0 }}>✅ BOT CONECTADO</h3></div>}
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
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{c.sent_count}/{c.total_count} ✅</span>
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
