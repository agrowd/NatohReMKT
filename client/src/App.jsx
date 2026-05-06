import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = window.location.protocol + '//' + window.location.hostname + ':3001';
const socket = io(API_URL);

function App() {
  const [status, setStatus] = useState('DESCONECTADO');
  const [qr, setQr] = useState(null);
  const [labels, setLabels] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [flowSteps, setFlowSteps] = useState([{ id: 1, type: 'message', content: '¡Hola! Tenemos novedades para vos 🚀' }]);

  useEffect(() => {
    socket.on('qr', (data) => { setQr(data); setStatus('ESPERANDO ESCANEO'); setIsStarting(false); });
    socket.on('ready', () => { setStatus('BOT ONLINE'); setQr(null); setIsStarting(false); fetchLabels(); });
    socket.on('labels', (data) => { console.log("Labels received via socket:", data); setLabels(data || []); });
    socket.on('disconnected', () => { setStatus('DESCONECTADO'); setQr(null); setLabels([]); });
    
    fetchLabels();
    return () => { socket.off('qr'); socket.off('ready'); socket.off('labels'); socket.off('disconnected'); };
  }, []);

  const fetchLabels = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/labels`);
      if (res.data && res.data.length > 0) setLabels(res.data);
    } catch (e) { console.error(e); }
  };

  const startBot = async () => {
    setIsStarting(true);
    try { await axios.post(`${API_URL}/api/whatsapp/start`); } catch (e) { setIsStarting(false); alert("Error al iniciar"); }
  };

  const stopBot = async () => {
    try { await axios.post(`${API_URL}/api/whatsapp/stop`); } catch (e) { alert("Error al detener"); }
  };

  const addStep = (type) => {
    const newStep = { id: Date.now(), type, content: '', duration: 10 };
    setFlowSteps([...flowSteps, newStep]);
  };

  const updateStep = (id, field, value) => {
    setFlowSteps(flowSteps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const startCampaign = async () => {
    if (status !== 'BOT ONLINE') return alert('El bot debe estar conectado');
    if (!selectedLabel) return alert('Seleccioná una etiqueta');
    try {
      const flowRes = await axios.post(`${API_URL}/api/flows`, { name: `Campaña ${new Date().toLocaleString()}`, steps: flowSteps });
      await axios.post(`${API_URL}/api/campaigns`, { flowId: flowRes.data.id, labelId: selectedLabel.id });
      alert('¡Campaña enviada a la cola de procesamiento!');
    } catch (e) { alert("Error al iniciar campaña"); }
  };

  return (
    <div className="app-wrapper">
      <nav className="nav-sidebar">
        <div className="nav-item active">⚡</div>
        <div className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}>🏠</div>
        <div className={`nav-item ${activeTab === 'flows' ? 'active' : ''}`} onClick={() => setActiveTab('flows')}>💾</div>
      </nav>

      <div className="main-layout">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>NatohReMKT</h1>
            <div className="status-indicator">
              <div className={`dot ${status === 'BOT ONLINE' ? 'dot-ready' : 'dot-waiting'}`} />
              <span style={{ fontSize: '0.7rem' }}>{status}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button className="btn" onClick={fetchLabels} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>🔄 Etiquetas</button>
             <button className="btn" onClick={status === 'DESCONECTADO' ? startBot : stopBot} 
                     style={{ background: status === 'DESCONECTADO' ? 'var(--primary)' : '#ff4444', color: '#000' }}>
               {isStarting ? '...' : status === 'DESCONECTADO' ? 'ENCENDER' : 'APAGAR'}
             </button>
          </div>
        </header>

        <div className="content-body" style={{ display: activeTab === 'builder' ? 'grid' : 'block' }}>
          {activeTab === 'builder' && (
            <>
              <aside className="sub-sidebar">
                <h3 style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '1rem' }}>ETIQUETAS ({labels.length})</h3>
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${selectedLabel?.id === l.id ? 'active' : ''}`} onClick={() => setSelectedLabel(l)}>
                    {l.name}
                  </div>
                ))}
                {labels.length === 0 && status === 'BOT ONLINE' && <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Sincronizando... (Esperá unos segundos)</p>}
              </aside>

              <main className="workspace">
                {status !== 'BOT ONLINE' && (
                  <div className="glass-card" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {qr ? (
                      <div className="qr-box">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`} alt="QR" />
                      </div>
                    ) : <p>{status === 'DESCONECTADO' ? 'Dale a "ENCENDER" para conectar' : 'Generando QR...'}</p>}
                  </div>
                )}

                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Constructor de Remarketing</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => addStep('message')}>+ Texto</button>
                       <button className="btn" style={{ background: 'var(--glass)', color: '#fff' }} onClick={() => addStep('delay')}>+ Espera</button>
                    </div>
                  </div>

                  {flowSteps.map((step, i) => (
                    <div key={step.id} className="flow-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: 0.5, fontSize: '0.7rem' }}>
                        <span>PASO {i+1} - {step.type.toUpperCase()}</span>
                        <span style={{ cursor: 'pointer' }} onClick={() => setFlowSteps(flowSteps.filter(s => s.id !== step.id))}>❌</span>
                      </div>
                      {step.type === 'message' ? (
                        <textarea value={step.content} onChange={(e) => updateStep(step.id, 'content', e.target.value)} placeholder="Escribí el mensaje..." rows={3} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                           <span>Esperar</span>
                           <input type="number" value={step.duration} onChange={(e) => updateStep(step.id, 'duration', e.target.value)} style={{ width: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '5px' }} />
                           <span>segundos</span>
                        </div>
                      )}
                    </div>
                  ))}

                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '50px' }} onClick={startCampaign}>
                    🚀 INICIAR ENVÍO
                  </button>
                </div>
              </main>
            </>
          )}

          {activeTab === 'flows' && (
            <div className="workspace">
               <div className="glass-card"><h3>Próximamente: Flujos Guardados</h3></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
