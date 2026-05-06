const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./database');
const { initWhatsApp, startClient, stopClient, logout, getLabels, getContactsByLabel, sendMessage } = require('./whatsapp');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const fs = require('fs');
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// --- Bot Control ---
app.post('/api/whatsapp/start', async (req, res) => {
    try { await startClient(); res.json({ message: 'Iniciado' }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/whatsapp/stop', async (req, res) => {
    try { await stopClient(); res.json({ message: 'Detenido' }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/whatsapp/logout', async (req, res) => {
    try { const result = await logout(); res.json(result); } catch (err) { res.status(500).json({ error: err.message }); }
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

// --- Labels ---
app.get('/api/labels', async (req, res) => {
    try { const labels = await getLabels(); res.json(labels || []); } catch (err) { res.json([]); }
});

// --- Campaigns ---
app.get('/api/campaigns', (req, res) => {
    res.json(db.prepare(`SELECT campaigns.*, flows.name as flow_name FROM campaigns JOIN flows ON campaigns.flow_id = flows.id ORDER BY campaigns.created_at DESC`).all());
});

app.post('/api/campaigns', async (req, res) => {
    const { flowId, labelIds, config } = req.body; 
    // config: { minLeadDelay, maxLeadDelay, minStepDelay, maxStepDelay }

    try {
        const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId);
        let allContacts = [];
        
        // Recorrer etiquetas una por una
        for (const labelId of labelIds) {
            const contacts = await getContactsByLabel(labelId);
            allContacts = [...allContacts, ...contacts];
        }

        // Eliminar duplicados (si un contacto esta en dos etiquetas)
        const uniqueContacts = Array.from(new Map(allContacts.map(c => [c.id._serialized, c])).values());

        const campaign = db.prepare('INSERT INTO campaigns (flow_id, label, total_count) VALUES (?, ?, ?)')
            .run(flowId, labelIds.join(','), uniqueContacts.length);
        
        const campaignId = campaign.lastInsertRowid;
        
        startCampaignProcess(campaignId, uniqueContacts, JSON.parse(flow.steps), config);
        
        res.json({ campaignId, contactCount: uniqueContacts.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Campaign Logic Engine ---
async function startCampaignProcess(campaignId, contacts, steps, config) {
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('running', campaignId);
    let sentCount = 0;

    for (const contact of contacts) {
        try {
            for (const step of steps) {
                if (step.type === 'message') {
                    const resolvedContent = resolveSpintax(step.content);
                    await sendMessage(contact.id._serialized, resolvedContent, step.mediaUrl);
                    
                    // Delay aleatorio entre mensajes del flujo
                    const stepDelay = Math.floor(Math.random() * (config.maxStepDelay - config.minStepDelay + 1) + config.minStepDelay);
                    await new Promise(r => setTimeout(r, stepDelay * 1000));
                } else if (step.type === 'delay') {
                    await new Promise(r => setTimeout(r, step.duration * 1000));
                }
            }

            sentCount++;
            db.prepare('UPDATE campaigns SET sent_count = ? WHERE id = ?').run(sentCount, campaignId);
            db.prepare('INSERT INTO logs (campaign_id, contact_id, status) VALUES (?, ?, ?)').run(campaignId, contact.id._serialized, 'sent');
            io.emit('campaign_progress', { campaignId, sentCount, total: contacts.length });

            // Delay aleatorio entre Leads
            const leadDelay = Math.floor(Math.random() * (config.maxLeadDelay - config.minLeadDelay + 1) + config.minLeadDelay);
            await new Promise(r => setTimeout(r, leadDelay * 1000));

        } catch (err) {
            console.error(`Error with ${contact.id._serialized}:`, err);
            db.prepare('INSERT INTO logs (campaign_id, contact_id, status, message) VALUES (?, ?, ?, ?)').run(campaignId, contact.id._serialized, 'error', err.message);
        }
    }
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('completed', campaignId);
    io.emit('campaign_finished', { campaignId });
}

function resolveSpintax(text) {
    return text.replace(/\{([^{}|]*\|[^{}]*)\}/g, (match, options) => {
        const choices = options.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
    });
}

initWhatsApp(io);
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { console.log(`API running on port ${PORT}`); });
