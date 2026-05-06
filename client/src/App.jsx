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
  LayoutDashboard,
  History,
  Info,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

function App() {
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [labels, setLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [flowSteps, setFlowSteps] = useState([
    { id: 1, type: 'message', content: 'Hola! Tenemos una oferta especial para vos 🚀' }
  ]);
  const [campaign, setCampaign] = useState(null);
  const [flows, setFlows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [view, setView] = useState('builder'); // 'builder', 'flows', 'history'
  const [selectedLogs, setSelectedLogs] = useState(null);

  useEffect(() => {
    socket.on('qr', (data) => {
      setQr(data);
      setStatus('waiting_qr');
    });

    socket.on('ready', () => {
      setStatus('ready');
      setQr(null);
      fetchLabels();
    });

    socket.on('labels', (data) => setLabels(data));
    socket.on('campaign_progress', (data) => setCampaign(data));
    socket.on('campaign_finished', () => {
      setCampaign(null);
      fetchCampaigns();
    });

    fetchLabels();
    fetchFlows();
    fetchCampaigns();

    return () => {
      socket.off('qr');
      socket.off('ready');
      socket.off('labels');
      socket.off('campaign_progress');
      socket.off('campaign_finished');
    };
  }, []);

  const fetchLabels = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/labels`);
      setLabels(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchFlows = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/flows`);
      setFlows(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/campaigns`);
      setCampaigns(res.data);
    } catch (err) { console.error(err); }
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
        name: `Campaña ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        steps: flowSteps
      });

      await axios.post(`${API_URL}/api/campaigns`, {
        flowId: flowRes.data.id,
        labelId: selectedLabel.id
      });

      alert('Campaña iniciada');
      fetchFlows();
      fetchCampaigns();
    } catch (err) { console.error(err); }
  };

  const viewLogs = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/api/campaigns/${id}/logs`);
      setSelectedLogs(res.data);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="glass-card sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <Zap size={24} color="#00ff88" fill="#00ff88" />
          <h2 style={{ marginBottom: 0 }}>NatohReMKT</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${view === 'builder' ? 'btn-primary' : ''}`} onClick={() => setView('builder')} style={{ flex: 1, padding: '0.5rem', fontSize: '0.7rem' }}>BUILDER</button>
          <button className={`btn ${view === 'flows' ? 'btn-primary' : ''}`} onClick={() => setView('flows')} style={{ flex: 1, padding: '0.5rem', fontSize: '0.7rem' }}>FLOWS</button>
          <button className={`btn ${view === 'history' ? 'btn-primary' : ''}`} onClick={() => setView('history')} style={{ flex: 1, padding: '0.5rem', fontSize: '0.7rem' }}>HISTORY</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'builder' && (
            <>
              <h3 style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase' }}>Etiquetas</h3>
              {labels.map(l => (
                <div key={l.id} className={`label-item ${selectedLabel?.id === l.id ? 'active' : ''}`} onClick={() => setSelectedLabel(l)}>
                  <div style={{ fontWeight: 600 }}>{l.name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{l.id}</div>
                </div>
              ))}
            </>
          )}

          {view === 'flows' && (
            <>
              <h3 style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase' }}>Flujos Guardados</h3>
              {flows.map(f => (
                <div key={f.id} className="label-item" onClick={() => setFlowSteps(JSON.parse(f.steps))}>
                  <div style={{ fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(f.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </>
          )}

          {view === 'history' && (
            <>
              <h3 style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase' }}>Historial</h3>
              {campaigns.map(c => (
                <div key={c.id} className="label-item" onClick={() => viewLogs(c.id)}>
                  <div style={{ fontWeight: 600 }}>{c.flow_name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{c.sent_count}/{c.total_count} enviados</div>
                  <div style={{ fontSize: '0.7rem', color: c.status === 'completed' ? 'var(--primary)' : 'orange' }}>{c.status.toUpperCase()}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Main Builder */}
      <main className="glass-card main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Constructor</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={() => addStep('message')} style={{ background: 'var(--glass)', color: '#fff' }}><MessageSquare size={16} /> MSG</button>
            <button className="btn" onClick={() => addStep('delay')} style={{ background: 'var(--glass)', color: '#fff' }}><Clock size={16} /> DELAY</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
          {flowSteps.map((step, i) => (
            <div key={step.id} className="flow-step">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: 0.5, fontSize: '0.7rem' }}>
                <span>PASO {i+1}</span>
                <Trash2 size={14} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))} style={{ cursor: 'pointer' }} />
              </div>
              
              {step.type === 'message' ? (
                <>
                  <textarea value={step.content} onChange={(e) => updateStep(step.id, 'content', e.target.value)} placeholder="Contenido... Usa {A|B} para Spintax" rows={3} />
                  <input type="file" onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const fd = new FormData(); fd.append('file', file);
                    const res = await axios.post(`${API_URL}/api/upload`, fd);
                    updateStep(step.id, 'mediaUrl', `${API_URL}${res.data.url}`);
                  }} style={{ fontSize: '0.7rem', marginTop: '0.5rem' }} />
                  {step.mediaUrl && <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Media OK</div>}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Clock size={16} />
                  <input type="number" value={step.duration} onChange={(e) => updateStep(step.id, 'duration', e.target.value)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: '#fff', padding: '0.3rem', borderRadius: '5px', width: '60px' }} />
                  <span style={{ fontSize: '0.8rem' }}>segundos</span>
                </div>
              )}
            </div>
          ))}
          
          <div style={{ padding: '1rem', background: 'rgba(0,255,136,0.05)', borderRadius: '12px', marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <Info size={16} color="var(--primary)" />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <strong>Tip:</strong> Usá <code>{"{Hola|Buenas|Que tal}"}</code> para que WhatsApp no detecte spam.
            </p>
          </div>
          
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '50px' }} onClick={startCampaign}>
            <Send size={18} /> INICIAR REMARKETING
          </button>
        </div>
      </main>

      {/* Right Panel */}
      <div className="right-panel">
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <h3>Estado</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <div className={`status-badge ${status === 'ready' ? 'status-ready' : 'status-pending'}`}>{status.toUpperCase()}</div>
          </div>
          {status !== 'ready' && qr && (
            <div className="qr-container"><div className="qr-box"><QRCode value={qr} size={150} /></div></div>
          )}
        </div>

        {campaign && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3>En curso</h3>
            <div className="campaign-progress">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>{campaign.sentCount} / {campaign.total}</span>
              </div>
              <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${(campaign.sentCount/campaign.total)*100}%` }}></div></div>
            </div>
          </div>
        )}

        {selectedLogs && (
          <div className="glass-card" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Logs</h3>
              <X size={18} onClick={() => setSelectedLogs(null)} style={{ cursor: 'pointer' }} />
            </div>
            {selectedLogs.map(l => (
              <div key={l.id} style={{ fontSize: '0.7rem', padding: '0.5rem', borderBottom: '1px solid var(--border)', color: l.status === 'error' ? '#ff4444' : '#fff' }}>
                {l.contact_id}: {l.status} {l.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
