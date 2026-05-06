import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

function App() {
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState('disconnected'); 
  const [activeTab, setActiveTab] = useState('builder'); 
  
  const [labels, setLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [flowSteps, setFlowSteps] = useState([
    { id: 1, type: 'message', content: 'Hola! Tenemos una oferta especial para vos 🚀' }
  ]);
  
  const [campaign, setCampaign] = useState(null);
  const [flows, setFlows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedLogs, setSelectedLogs] = useState(null);
  const [isBotStarting, setIsBotStarting] = useState(false);

  useEffect(() => {
    socket.on('qr', (data) => {
      setQr(data);
      setStatus('waiting_qr');
      setIsBotStarting(false);
    });

    socket.on('ready', () => {
      setStatus('ready');
      setQr(null);
      setIsBotStarting(false);
      fetchData();
    });

    socket.on('disconnected', () => {
      setStatus('disconnected');
      setQr(null);
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
      socket.off('disconnected');
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
    } catch (err) { console.error(err); }
  };

  const fetchFlows = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/flows`);
      setFlows(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/campaigns`);
      setCampaigns(res.data || []);
    } catch (err) { console.error(err); }
  };

  const toggleBot = async () => {
    if (status === 'disconnected') {
      setIsBotStarting(true);
      try {
        await axios.post(`${API_URL}/api/whatsapp/start`);
      } catch (e) {
        setIsBotStarting(false);
        alert('Error al iniciar bot');
      }
    } else {
      try {
        await axios.post(`${API_URL}/api/whatsapp/stop`);
      } catch (e) {
        alert('Error al detener bot');
      }
    }
  };

  const addStep = (type) => {
    const newStep = { id: Date.now(), type, content: '', duration: 10, mediaUrl: null };
    setFlowSteps([...flowSteps, newStep]);
  };

  const updateStep = (id, field, value) => {
    setFlowSteps(flowSteps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const startCampaign = async () => {
    if (status !== 'ready') return alert('El bot debe estar conectado');
    if (!selectedLabel) return alert('Seleccioná una etiqueta');
    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, {
        name: `Campana ${new Date().toLocaleString()}`,
        steps: flowSteps
      });
      await axios.post(`${API_URL}/api/campaigns`, {
        flowId: flowRes.data.id,
        labelId: selectedLabel.id
      });
      alert('Campaña iniciada');
    } catch (e) { console.error(e); }
  };

  // --- RENDERS ---

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active" style={{ fontSize: '1.5rem' }}>⚡</div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}>🏠</div>
        <div className={`nav-item ${activeTab === 'flows' ? 'active' : ''}`} onClick={() => setActiveTab('flows')}>💾</div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜</div>
      </nav>

      <div className="main-layout">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.2rem' }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'ready' ? 'dot-ready' : 'dot-waiting'}`} />
              <span style={{ fontSize: '0.7rem' }}>{status.toUpperCase()}</span>
            </div>
          </div>
          
          <button className={`btn ${status === 'disconnected' ? 'btn-primary' : ''}`} 
                  onClick={toggleBot} disabled={isBotStarting}
                  style={{ background: status === 'disconnected' ? 'var(--primary)' : '#ff4444', color: '#000' }}>
            {isBotStarting ? 'Iniciando...' : status === 'disconnected' ? 'Encender Bot' : 'Apagar Bot'}
          </button>
        </header>

        <div className="content-body" style={{ display: activeTab === 'builder' ? 'grid' : 'block' }}>
          {activeTab === 'builder' && (
            <>
              <aside className="sub-sidebar">
                <h3>Etiquetas</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabel?.id === l.id ? 'active' : ''}`} onClick={() => setSelectedLabel(l)}>
                    {l.name}
                  </div>
                ))}
              </aside>
              <main className="workspace">
                {status !== 'ready' && (
                  <div className="glass-card" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {qr ? (
                      <div className="qr-box"><QRCode value={qr} size={200} /></div>
                    ) : (
                      <p>{status === 'disconnected' ? 'Presioná "Encender Bot" para ver el QR' : 'Generando QR...'}</p>
                    )}
                  </div>
                )}
                
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3>Constructor</h3>
                    <div>
                      <button onClick={() => addStep('message')}>+ Msg</button>
                      <button onClick={() => addStep('delay')}>+ Espera</button>
                    </div>
                  </div>
                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                        <span>Paso {i+1} - {step.type}</span>
                        <span onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))} style={{ cursor: 'pointer' }}>❌</span>
                      </div>
                      {step.type === 'message' ? (
                        <textarea value={step.content} onChange={(e) => updateStep(step.id, 'content', e.target.value)} />
                      ) : (
                        <input type="number" value={step.duration} onChange={(e) => updateStep(step.id, 'duration', e.target.value)} />
                      )}
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={startCampaign}>Iniciar</button>
                </div>
              </main>
            </>
          )}

          {activeTab === 'flows' && (
             <div className="workspace">
                <div className="glass-card">
                  <h3>Flujos Guardados</h3>
                  {flows.map(f => (
                    <div key={f.id} className="label-item" onClick={() => { setFlowSteps(JSON.parse(f.steps)); setActiveTab('builder'); }}>
                      {f.name}
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'history' && (
             <div className="workspace">
                <div className="glass-card">
                  <h3>Historial</h3>
                  {campaigns.map(c => (
                    <div key={c.id} className="label-item">{c.flow_name} - {c.sent_count}/{c.total_count}</div>
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
