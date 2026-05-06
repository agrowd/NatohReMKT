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
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for media
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

// --- Routes ---

// Bot Control
app.post('/api/whatsapp/start', async (req, res) => {
    try { await startClient(); res.json({ message: 'Bot iniciado' }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/stop', async (req, res) => {
    try { await stopClient(); res.json({ message: 'Bot detenido' }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/logout', async (req, res) => {
    try { const result = await logout(); res.json(result); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Flows
app.get('/api/flows', (req, res) => {
    const flows = db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all();
    res.json(flows);
});

app.post('/api/flows', (req, res) => {
    const { name, steps } = req.body;
    const info = db.prepare('INSERT INTO flows (name, steps) VALUES (?, ?)').run(name, JSON.stringify(steps));
    res.json({ id: info.lastInsertRowid });
});

// WhatsApp Labels
app.get('/api/labels', async (req, res) => {
    try {
        const labels = await getLabels();
        res.json(labels || []);
    } catch (err) {
        console.error('Labels API Error:', err.message);
        res.json([]);
    }
});

// Campaigns
app.get('/api/campaigns', (req, res) => {
    const campaigns = db.prepare(`SELECT campaigns.*, flows.name as flow_name FROM campaigns JOIN flows ON campaigns.flow_id = flows.id ORDER BY campaigns.created_at DESC`).all();
    res.json(campaigns);
});

app.get('/api/campaigns/:id/logs', (req, res) => {
    const logs = db.prepare('SELECT * FROM logs WHERE campaign_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(logs);
});

app.post('/api/campaigns', async (req, res) => {
    const { flowId, labelId } = req.body;
    try {
        const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId);
        const contacts = await getContactsByLabel(labelId);
        const campaign = db.prepare('INSERT INTO campaigns (flow_id, label, total_count) VALUES (?, ?, ?)').run(flowId, labelId, contacts.length);
        const campaignId = campaign.lastInsertRowid;
        startCampaignProcess(campaignId, contacts, JSON.parse(flow.steps));
        res.json({ campaignId, contactCount: contacts.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helpers
function resolveSpintax(text) {
    const spintaxRegex = /\{([^{}|]*\|[^{}]*)\}/g;
    let result = text;
    while (spintaxRegex.test(result)) {
        result = result.replace(spintaxRegex, (match, options) => {
            const choices = options.split('|');
            return choices[Math.floor(Math.random() * choices.length)];
        });
    }
    return result;
}

async function startCampaignProcess(campaignId, contacts, steps) {
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('running', campaignId);
    let sentCount = 0;
    for (const contact of contacts) {
        try {
            for (const step of steps) {
                if (step.type === 'message') {
                    const resolvedContent = resolveSpintax(step.content);
                    await sendMessage(contact.id._serialized, resolvedContent, step.mediaUrl);
                } else if (step.type === 'delay') {
                    await new Promise(resolve => setTimeout(resolve, step.duration * 1000));
                }
            }
            sentCount++;
            db.prepare('UPDATE campaigns SET sent_count = ? WHERE id = ?').run(sentCount, campaignId);
            db.prepare('INSERT INTO logs (campaign_id, contact_id, status) VALUES (?, ?, ?)').run(campaignId, contact.id._serialized, 'sent');
            io.emit('campaign_progress', { campaignId, sentCount, total: contacts.length });
            await new Promise(resolve => setTimeout(resolve, (Math.random() * 10 + 5) * 1000));
        } catch (err) {
            console.error(`Error sending to ${contact.id._serialized}:`, err);
            db.prepare('INSERT INTO logs (campaign_id, contact_id, status, message) VALUES (?, ?, ?, ?)').run(campaignId, contact.id._serialized, 'error', err.message);
        }
    }
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('completed', campaignId);
    io.emit('campaign_finished', { campaignId });
}

initWhatsApp(io);
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { console.log(`Server running on port ${PORT}`); });
