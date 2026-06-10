const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./database');
const { initWhatsApp, startClient, stopClient, logout, getLabels, getContactsByLabel, syncAllContacts, deepSyncLabels, tagContactsByQuery, sendMessage, getStatus, searchMessagesInHistory, cancelSearch, bulkTagChats, getActiveSearch, syncLabelsAndMembers } = require('./whatsapp');



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let activeCampaign = null;

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const fs = require('fs');
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// --- Auth ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
        res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

app.put('/api/users/update', (req, res) => {
    const { id, username, password } = req.body;
    db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run(username, password, id);
    res.json({ success: true });
});

// --- Multimedia ---
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const fullPath = path.join(__dirname, 'uploads', req.file.filename);
    res.json({ url: fullPath, filename: req.file.filename });
});

// --- Bot Control ---
app.get('/api/whatsapp/status', (req, res) => {
    res.json({ ...getStatus(), activeCampaign, activeSearch: getActiveSearch() });
});
app.post('/api/whatsapp/start', async (req, res) => {
    try { await startClient(); res.json({ message: 'OK' }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/whatsapp/stop', async (req, res) => {
    try { await stopClient(); res.json({ message: 'OK' }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/whatsapp/logout', async (req, res) => {
    try { await logout(); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Message Search & Tagging (Escenario B) ---
app.post('/api/whatsapp/search-messages', async (req, res) => {
    const { query, chatLimit, messageLimit } = req.body;
    if (!query) return res.status(400).json({ error: 'Debe ingresar una palabra clave.' });
    try {
        searchMessagesInHistory(query, chatLimit, messageLimit).catch(err => {
            console.error("Error asíncrono en búsqueda:", err);
        });
        res.json({ success: true, message: 'Búsqueda iniciada en segundo plano.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/cancel-search', async (req, res) => {
    try {
        const cancelled = await cancelSearch();
        res.json({ success: cancelled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/bulk-tag', async (req, res) => {
    const { chatIds, labelId } = req.body;
    if (!chatIds || !Array.isArray(chatIds) || !labelId) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (chatIds, labelId).' });
    }
    try {
        bulkTagChats(chatIds, labelId).catch(err => {
            console.error("Error asíncrono en bulk-tag:", err);
        });
        res.json({ success: true, message: 'Proceso de etiquetado masivo iniciado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/send-direct', async (req, res) => {
    const { to, content } = req.body;
    if (!to || !content) return res.status(400).json({ error: 'Faltan campos obligatorios (to, content).' });
    try {
        await sendMessage(to, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// --- Flows ---
app.get('/api/flows', (req, res) => {
    res.json(db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all());
});
app.post('/api/flows', (req, res) => {
    const { name, steps } = req.body;
    const info = db.prepare('INSERT INTO flows (name, steps) VALUES (?, ?)').run(name, JSON.stringify(steps));
    res.json({ id: info.lastInsertRowid });
});
app.put('/api/flows/:id', (req, res) => {
    const { name } = req.body;
    db.prepare('UPDATE flows SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json({ success: true });
});
app.delete('/api/flows/:id', (req, res) => {
    db.prepare('DELETE FROM flows WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- Labels ---
app.get('/api/labels', async (req, res) => {
    try { 
        const sync = req.query.sync === 'true';
        const labels = sync ? await syncLabelsAndMembers() : await getLabels(); 
        const stats = db.prepare('SELECT label_id, COUNT(*) as count FROM label_members GROUP BY label_id').all();
        
        const labelsWithStats = labels.map(l => {
            const stat = stats.find(s => s.label_id === l.id);
            return { ...l, memberCount: stat ? stat.count : 0 };
        });
        
        res.json(labelsWithStats); 
    } catch (err) { res.json([]); }
});

// --- Contacts & Smart Tagging ---
app.post('/api/contacts/sync', async (req, res) => {
    try { syncAllContacts(); res.json({ message: 'Sync started' }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts/deep-sync', async (req, res) => {
    try { deepSyncLabels(); res.json({ message: 'Deep sync started' }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts/smart-tag', async (req, res) => {
    const { query, labelId, limit } = req.body;
    console.log(`--- SMART TAG REQUEST: query="${query}", label="${labelId}", limit=${limit} ---`);
    if (!query || !labelId) return res.status(400).json({ error: 'Faltan campos' });
    
    try {
        // Ejecutar y capturar errores iniciales
        tagContactsByQuery(query, labelId, limit || 200).catch(err => {
            console.error("Async Tagging Error:", err);
        });
        res.json({ message: 'Proceso iniciado' });
    } catch (err) { 
        console.error("Sync Tagging Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// --- Campaigns ---
app.get('/api/campaigns', (req, res) => {
    res.json(db.prepare(`
        SELECT campaigns.*, flows.name as flow_name, flows.steps 
        FROM campaigns 
        JOIN flows ON campaigns.flow_id = flows.id 
        ORDER BY campaigns.created_at DESC
    `).all());
});

app.post('/api/campaigns', async (req, res) => {
    const { flowId, labelIds, config } = req.body; 
    try {
        const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId);
        let allContacts = [];
        for (const labelId of labelIds) {
            const contacts = await getContactsByLabel(labelId);
            // Inyectamos el labelId original en cada contacto para saber de dónde sacarlo luego
            const contactsWithLabel = contacts.map(c => ({ ...c, sourceLabelId: labelId }));
            allContacts = [...allContacts, ...contactsWithLabel];
        }
        const uniqueContacts = Array.from(new Map(allContacts.map(c => [c.id._serialized, c])).values());
        const campaign = db.prepare('INSERT INTO campaigns (flow_id, label, total_count) VALUES (?, ?, ?)')
            .run(flowId, labelIds.join(','), uniqueContacts.length);
        const campaignId = campaign.lastInsertRowid;
        activeCampaign = { campaignId, flowName: flow.name, sentCount: 0, total: uniqueContacts.length };
        startCampaignProcess(campaignId, uniqueContacts, JSON.parse(flow.steps), config);
        res.json({ campaignId, contactCount: uniqueContacts.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Engine ---
async function startCampaignProcess(campaignId, contacts, steps, config) {
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('running', campaignId);
    let sentCount = 0;
    for (const contact of contacts) {
        try {
            // Regla de Exclusión de 48 Horas o Permanente
            if (config.exclude48h || config.excludeEver) {
                const timeFilter = config.excludeEver ? "" : "AND created_at > datetime('now', '-48 hours')";
                const recentSend = db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM logs 
                    WHERE contact_id = ? 
                    AND status = 'sent' 
                    ${timeFilter}
                `).get(contact.id._serialized);

                if (recentSend.count > 0) {
                    console.log(`[ENGINE] Saltando ${contact.id._serialized} (Ya enviado)`);
                    db.prepare('INSERT INTO logs (campaign_id, contact_id, status, message) VALUES (?, ?, ?, ?)').run(campaignId, contact.id._serialized, 'skipped', 'Excluido (Ya enviado)');
                    continue; // No lo contamos para el límite de lote si fue saltado
                }
            }

            // Verificar Límite de Lote (Batch Limit)
            if (config.batchLimit && sentCount >= config.batchLimit) {
                console.log(`[ENGINE] Límite de lote alcanzado (${config.batchLimit}). Deteniendo.`);
                break; 
            }

            for (const step of steps) {
                if (step.type === 'message') {
                    // Seleccionar una variante aleatoria si existe el array de variantes
                    let baseContent = step.content || "";
                    if (step.variants && step.variants.length > 0) {
                        const validVariants = step.variants.filter(v => typeof v === 'string' && v.trim() !== "");
                        if (validVariants.length > 0) {
                            baseContent = validVariants[Math.floor(Math.random() * validVariants.length)];
                        }
                    }

                    const resolvedContent = resolveSpintax(baseContent); // Mantenemos spintax por si alguien lo escribe manual
                    await sendMessage(contact.id._serialized, resolvedContent, step.mediaPath);
                    const stepDelay = Math.floor(Math.random() * (config.maxStepDelay - config.minStepDelay + 1) + config.minStepDelay);
                    await new Promise(r => setTimeout(r, stepDelay * 1000));
                } else if (step.type === 'delay') {
                    await new Promise(r => setTimeout(r, step.duration * 1000));
                }
            }
            sentCount++;
            if(activeCampaign) activeCampaign.sentCount = sentCount;
            db.prepare('UPDATE campaigns SET sent_count = ? WHERE id = ?').run(sentCount, campaignId);
            db.prepare('INSERT INTO logs (campaign_id, contact_id, status) VALUES (?, ?, ?)').run(campaignId, contact.id._serialized, 'sent');
            
            // Lógica de Limpieza (Auto-Remove)
            if (config.autoRemove && contact.sourceLabelId) {
                db.prepare('DELETE FROM label_members WHERE label_id = ? AND contact_id = ?').run(contact.sourceLabelId, contact.id._serialized);
            }

            io.emit('campaign_progress', activeCampaign);
            const leadDelay = Math.floor(Math.random() * (config.maxLeadDelay - config.minLeadDelay + 1) + config.minLeadDelay);
            await new Promise(r => setTimeout(r, leadDelay * 1000));
        } catch (err) {
            db.prepare('INSERT INTO logs (campaign_id, contact_id, status, message) VALUES (?, ?, ?, ?)').run(campaignId, contact.id._serialized, 'error', err.message);
        }
    }
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('completed', campaignId);
    activeCampaign = null;
    io.emit('campaign_finished', { campaignId });
}

function resolveSpintax(text) {
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
}

initWhatsApp(io);
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { console.log(`API running on port ${PORT}`); });
