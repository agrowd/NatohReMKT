import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { 
  MessageSquare, 
  Clock, 
  Send, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Zap,
  Users,
  Layout,
  Server,
  Info,
  X,
  Wifi,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

function App() {
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState('disconnected'); // disconnected, waiting_qr, ready
  const [activeTab, setActiveTab] = useState('builder'); // builder, flows, history
  
  const [labels, setLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [flowSteps, setFlowSteps] = useState([
    { id: 1, type: 'message', content: 'Hola! Tenemos una oferta especial para vos 🚀' }
  ]);
  
  const [campaign, setCampaign] = useState(null);
  const [flows, setFlows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedLogs, setSelectedLogs] = useState(null);

  useEffect(() => {
    socket.on('qr', (data) => {
      console.log('--- SOCKET QR RECEIVED ---');
      setQr(data);
      setStatus('waiting_qr');
    });

    socket.on('ready', () => {
      console.log('--- SOCKET READY RECEIVED ---');
      setStatus('ready');
      setQr(null);
      fetchData();
    });

    socket.on('labels', (data) => setLabels(data));
    socket.on('campaign_progress', (data) => setCampaign(data));
    socket.on('campaign_finished', () => {
      setCampaign(null);
      fetchCampaigns();
    });

    fetchData();

    return () => {
      socket.off('qr');
      socket.off('ready');
      socket.off('labels');
      socket.off('campaign_progress');
      socket.off('campaign_finished');
    };
  }, []);

  const fetchData = () => {
    fetchLabels();
    fetchFlows();
    fetchCampaigns();
  };

  const fetchLabels = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/labels`);
      setLabels(res.data || []);
    } catch (err) { console.error("Error labels:", err); }
  };

  const fetchFlows = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/flows`);
      setFlows(res.data || []);
    } catch (err) { console.error("Error flows:", err); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/campaigns`);
      setCampaigns(res.data || []);
    } catch (err) { console.error("Error campaigns:", err); }
  };

  const addStep = (type) => {
    const newStep = {
      id: Date.now(),
      type,
      content: type === 'message' ? '' : 10,
      mediaUrl: null
    };
    setFlowSteps([...flowSteps, newStep]);
  };

  const updateStep = (id, field, value) => {
    setFlowSteps(flowSteps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const startCampaign = async () => {
    if (!selectedLabel) return alert('Seleccioná una etiqueta primero');
    if (flowSteps.length === 0) return alert('Agregá al menos un paso al flujo');

    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, {
        name: `Campana ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        steps: flowSteps
      });

      await axios.post(`${API_URL}/api/campaigns`, {
        flowId: flowRes.data.id,
        labelId: selectedLabel.id
      });

      alert('Iniciando campaña...');
      fetchData();
    } catch (err) { console.error(err); }
  };

  // --- Render Sections ---

  const renderConnectionView = () => (
    <div className="workspace">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card connection-card">
        <WifiOff size={48} color="#ffaa00" style={{ marginBottom: '1rem' }} />
        <h2>Vincular WhatsApp</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Escaneá el código QR para comenzar a usar NatohReMKT</p>
        
        {qr ? (
          <div className="qr-box">
            <QRCode value={qr} size={250} />
          </div>
        ) : (
          <div style={{ margin: '3rem 0', opacity: 0.5 }}>
            <div className="loader"></div>
            <p>Esperando señal del servidor...</p>
            <p style={{ fontSize: '0.8rem', marginTop: '1rem' }}>Si tarda mucho, reiniciá el backend con PM2.</p>
          </div>
        )}
      </motion.div>
    </div>
  );

  const renderBuilder = () => (
    <div className="content-body">
      <aside className="sub-sidebar">
        <h3 style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Etiquetas Disponibles</h3>
        {labels.map(l => (
          <div key={l.id} className={`label-item ${selectedLabel?.id === l.id ? 'active' : ''}`} onClick={() => setSelectedLabel(l)}>
            <div style={{ fontWeight: 600 }}>{l.name}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{l.id}</div>
          </div>
        ))}
        {labels.length === 0 && <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>Cargando etiquetas...</p>}
      </aside>
      
      <main className="workspace">
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0 }}>Constructor de Flujo</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={() => addStep('message')} style={{ background: 'var(--glass)', color: '#fff' }}><MessageSquare size={18} /> Mensaje</button>
              <button className="btn" onClick={() => addStep('delay')} style={{ background: 'var(--glass)', color: '#fff' }}><Clock size={18} /> Espera</button>
            </div>
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '1rem' }}>
            <AnimatePresence>
              {flowSteps.map((step, i) => (
                <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flow-step">
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', opacity: 0.5, fontSize: '0.75rem' }}>
                    <span>PASO {i+1}</span>
                    <Trash2 size={16} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))} style={{ cursor: 'pointer' }} />
                  </div>
                  {step.type === 'message' ? (
                    <>
                      <textarea value={step.content} onChange={(e) => updateStep(step.id, 'content', e.target.value)} placeholder="Contenido del mensaje..." rows={4} />
                      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input type="file" onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const fd = new FormData(); fd.append('file', file);
                          const res = await axios.post(`${API_URL}/api/upload`, fd);
                          updateStep(step.id, 'mediaUrl', `${API_URL}${res.data.url}`);
                        }} style={{ fontSize: '0.8rem' }} />
                        {step.mediaUrl && <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>✓ Multimedia listo</span>}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Clock size={20} color="var(--primary)" />
                      <span>Esperar</span>
                      <input type="number" value={step.duration} onChange={(e) => updateStep(step.id, 'duration', e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', padding: '0.5rem', borderRadius: '8px', width: '80px' }} />
                      <span>segundos</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '60px', fontSize: '1.1rem' }} onClick={startCampaign}>
            <Send size={20} /> INICIAR REMARKETING
          </button>
        </div>
      </main>
    </div>
  );

  const renderFlows = () => (
    <div className="workspace">
      <div className="glass-card">
        <h2>Mis Flujos</h2>
        <div style={{ marginTop: '2rem' }}>
          {flows.map(f => (
            <div key={f.id} className="label-item" onClick={() => { setFlowSteps(JSON.parse(f.steps)); setActiveTab('builder'); }} style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{f.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(f.created_at).toLocaleString()}</div>
              </div>
              <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }}>Cargar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="content-body">
      <aside className="sub-sidebar">
        <h3 style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Campañas Pasadas</h3>
        {campaigns.map(c => (
          <div key={c.id} className="label-item" onClick={async () => {
            const res = await axios.get(`${API_URL}/api/campaigns/${c.id}/logs`);
            setSelectedLogs({ campaign: c, logs: res.data });
          }}>
            <div style={{ fontWeight: 600 }}>{c.flow_name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </aside>
      <main className="workspace">
        {selectedLogs ? (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <h2>Logs de {selectedLogs.campaign.flow_name}</h2>
              <button className="btn" onClick={() => setSelectedLogs(null)} style={{ background: 'var(--glass)', color: '#fff' }}><X size={18} /> Cerrar</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {selectedLogs.logs.map(log => (
                <div key={log.id} style={{ padding: '0.8rem', borderBottom: '1px solid var(--border)', fontSize: '0.9rem', color: log.status === 'error' ? '#ff4444' : '#fff' }}>
                  [{new Date(log.created_at).toLocaleTimeString()}] {log.contact_id}: {log.status} {log.message || ''}
                </div>
              ))}
            </div>
          </div>
        ) : <p style={{ opacity: 0.5 }}>Seleccioná una campaña para ver los logs.</p>}
      </main>
    </div>
  );

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ marginBottom: '2rem', border: 'none', background: 'none' }}><Zap size={32} color="var(--primary)" /></div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}><Layout size={24} /></div>
        <div className={`nav-item ${activeTab === 'flows' ? 'active' : ''}`} onClick={() => setActiveTab('flows')}><Server size={24} /></div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><Clock size={24} /></div>
      </nav>

      <div className="main-layout">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'ready' ? 'dot-ready' : 'dot-waiting'}`} />
              {status === 'ready' ? 'BOT ONLINE' : 'ESPERANDO CONEXIÓN'}
            </div>
          </div>
          
          {campaign && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--glass)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>ENVIANDO: {campaign.sentCount}/{campaign.total}</span>
              <div style={{ width: '100px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(campaign.sentCount/campaign.total)*100}%`, height: '100%', background: 'var(--primary)' }} />
              </div>
            </div>
          )}
        </header>

        {status !== 'ready' ? renderConnectionView() : (
          <>
            {activeTab === 'builder' && renderBuilder()}
            {activeTab === 'flows' && renderFlows()}
            {activeTab === 'history' && renderHistory()}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
