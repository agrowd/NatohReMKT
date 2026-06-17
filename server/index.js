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

// --- Helper Functions for VCF/CSV Importing and Normalization ---
function decodeQuotedPrintable(str) {
    if (!str) return "";
    let cleaned = str.replace(/=\r?\n/g, "");
    try {
        return cleaned.replace(/(?:=[0-9A-F]{2})+/gi, (match) => {
            const bytes = match.split('=').slice(1).map(hex => parseInt(hex, 16));
            return Buffer.from(bytes).toString('utf-8');
        });
    } catch (e) {
        return cleaned;
    }
}

function normalizePhoneNumber(num) {
    if (!num) return null;
    let cleaned = num.replace(/\D/g, '');
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }
    
    if (cleaned.startsWith('54')) {
        if (cleaned.startsWith('54915')) {
            cleaned = '549' + cleaned.substring(5);
        } else if (cleaned.startsWith('5415')) {
            cleaned = '549' + cleaned.substring(4);
        } else if (!cleaned.startsWith('549')) {
            if (cleaned.length === 12) {
                cleaned = '549' + cleaned.substring(2);
            }
        }
    } else {
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        
        if (cleaned.startsWith('15') && cleaned.length === 9) {
            cleaned = cleaned.substring(2);
        } else if (cleaned.length === 10) {
            cleaned = '549' + cleaned;
        } else if (cleaned.includes('15')) {
            const idx = cleaned.indexOf('15');
            if (idx > 0 && idx < 5 && cleaned.length >= 11) {
                cleaned = cleaned.substring(0, idx) + cleaned.substring(idx + 2);
            }
        }
        
        if (cleaned.length === 10) {
            cleaned = '549' + cleaned;
        } else if (cleaned.length === 11 && cleaned.startsWith('9')) {
            cleaned = '54' + cleaned;
        }
    }
    
    if (cleaned && (cleaned.startsWith('549') || cleaned.length >= 10)) {
        return cleaned + '@c.us';
    }
    return null;
}

function parseVCF(vcfContent) {
    const contacts = [];
    const unfolded = vcfContent.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    
    let currentContact = null;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.toUpperCase() === 'BEGIN:VCARD') {
            currentContact = { name: '', numbers: [] };
            continue;
        }
        
        if (line.toUpperCase() === 'END:VCARD') {
            if (currentContact && currentContact.numbers.length > 0) {
                contacts.push(currentContact);
            }
            currentContact = null;
            continue;
        }
        
        if (!currentContact) continue;
        
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        
        const keyPart = line.substring(0, colonIdx);
        const valuePart = line.substring(colonIdx + 1);
        
        const keyParts = keyPart.split(';');
        const propName = keyParts[0].toUpperCase();
        
        if (propName === 'FN' || (propName === 'N' && !currentContact.name)) {
            let name = valuePart;
            const isQP = keyParts.some(p => p.toUpperCase() === 'ENCODING=QUOTED-PRINTABLE');
            if (isQP) {
                name = decodeQuotedPrintable(name);
            }
            
            if (propName === 'N') {
                const parts = name.split(';').map(p => p.trim()).filter(Boolean);
                if (parts.length > 1) {
                    name = parts.slice(1).join(' ') + ' ' + parts[0];
                } else {
                    name = parts.join(' ');
                }
                name = name.trim();
            }
            
            if (propName === 'FN' || !currentContact.name) {
                currentContact.name = name;
            }
        } else if (propName === 'TEL') {
            currentContact.numbers.push(valuePart.trim());
        }
    }
    
    return contacts;
}

function parseCSV(csvContent) {
    const lines = csvContent.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    let delimiter = ',';
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if (semicolons > commas && semicolons > tabs) delimiter = ';';
    else if (tabs > commas && tabs > semicolons) delimiter = '\t';
    
    const parseCSVLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(cur.trim().replace(/^"|"$/g, ''));
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim().replace(/^"|"$/g, ''));
        return result;
    };
    
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    let nameIndices = [];
    let phoneIndices = [];
    
    headers.forEach((h, idx) => {
        if (h.includes('name') || h.includes('nombre') || h.includes('display') || h === 'fn' || h === 'n' || h.includes('first') || h.includes('given') || h.includes('last') || h.includes('apellido')) {
            nameIndices.push(idx);
        }
        if (h.includes('phone') || h.includes('tel') || h.includes('cel') || h.includes('movil') || h.includes('mobile') || h.includes('value')) {
            phoneIndices.push(idx);
        }
    });
    
    if (nameIndices.length === 0) nameIndices = [0];
    if (phoneIndices.length === 0) phoneIndices = [1];
    
    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length === 0) continue;
        
        let name = nameIndices
            .map(idx => row[idx])
            .filter(Boolean)
            .join(' ')
            .trim();
            
        const numbers = phoneIndices
            .map(idx => row[idx])
            .filter(Boolean)
            .map(p => p.trim());
            
        if (name && numbers.length > 0) {
            contacts.push({ name, numbers });
        }
    }
    
    return contacts;
}

// --- Virtual Lists API ---
app.get('/api/virtual-lists', (req, res) => {
    try {
        const lists = db.prepare(`
            SELECT vl.id, vl.name, vl.color, vl.created_at, COUNT(vlm.contact_id) as memberCount
            FROM virtual_lists vl
            LEFT JOIN virtual_list_members vlm ON vl.id = vlm.list_id
            GROUP BY vl.id
            ORDER BY vl.created_at DESC
        `).all();
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/virtual-lists', (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    try {
        const info = db.prepare('INSERT INTO virtual_lists (name, color) VALUES (?, ?)').run(name, color || '#4f46e5');
        res.json({ id: info.lastInsertRowid, name, color });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/virtual-lists/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM virtual_lists WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/virtual-lists/bulk-add', (req, res) => {
    const { listId, contacts } = req.body;
    if (!listId || !contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Faltan parámetros (listId, contacts)' });
    }
    try {
        const insertContact = db.prepare(`
            INSERT OR REPLACE INTO contacts (id, name, number, pushname) 
            VALUES (?, ?, ?, ?)
        `);
        const insertMember = db.prepare(`
            INSERT OR IGNORE INTO virtual_list_members (list_id, contact_id) 
            VALUES (?, ?)
        `);
        
        const transaction = db.transaction((listId, contacts) => {
            let added = 0;
            for (const c of contacts) {
                let cid = c.id;
                if (!cid) {
                    let num = c.number || '';
                    num = num.replace(/\D/g, '');
                    if (num) cid = num + '@c.us';
                }
                if (!cid) continue;
                
                insertContact.run(cid, c.name || c.pushname || '', c.number || '', c.pushname || '');
                const info = insertMember.run(listId, cid);
                if (info.changes > 0) added++;
            }
            return added;
        });
        
        const addedCount = transaction(listId, contacts);
        res.json({ success: true, addedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts/import-vcf', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
    let { listId, listName, filterQuery, excludeSent } = req.body;
    
    // Convert excludeSent to boolean (default to true)
    const shouldExcludeSent = excludeSent !== 'false';
    
    try {
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        let contactsParsed = [];
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        if (ext === '.vcf') {
            contactsParsed = parseVCF(fileContent);
        } else if (ext === '.csv') {
            contactsParsed = parseCSV(fileContent);
        } else {
            return res.status(400).json({ error: 'Formato de archivo no soportado. Suba .vcf o .csv' });
        }
        
        fs.unlinkSync(filePath);
        
        // 1. Create virtual list on the fly if listName is provided
        if (listName && listName.trim()) {
            listName = listName.trim();
            // Try to find if list already exists
            let existingList = db.prepare('SELECT id FROM virtual_lists WHERE name = ?').get(listName);
            if (existingList) {
                listId = existingList.id;
            } else {
                const info = db.prepare('INSERT INTO virtual_lists (name, color) VALUES (?, ?)').run(listName, '#4f46e5');
                listId = info.lastInsertRowid;
            }
        }
        
        // 2. Get set of already messaged contacts if shouldExcludeSent is true
        const sentContactIds = new Set();
        if (shouldExcludeSent) {
            const sentLogs = db.prepare("SELECT DISTINCT contact_id FROM logs WHERE status = 'sent'").all();
            sentLogs.forEach(l => sentContactIds.add(l.contact_id));
        }
        
        const insertContact = db.prepare(`
            INSERT OR REPLACE INTO contacts (id, name, number, pushname) 
            VALUES (?, ?, ?, ?)
        `);
        
        let insertMember = null;
        if (listId) {
            insertMember = db.prepare(`
                INSERT OR IGNORE INTO virtual_list_members (list_id, contact_id) 
                VALUES (?, ?)
            `);
        }
        
        let totalContacts = 0;
        let associatedCount = 0;
        let skippedCount = 0;
        
        const transaction = db.transaction(() => {
            for (const c of contactsParsed) {
                // Apply name filter query if provided
                if (filterQuery && filterQuery.trim()) {
                    const q = filterQuery.toLowerCase().trim();
                    const name = (c.name || '').toLowerCase();
                    if (!name.includes(q)) {
                        continue;
                    }
                }
                
                for (const rawNum of c.numbers) {
                    const normalized = normalizePhoneNumber(rawNum);
                    if (!normalized) continue;
                    
                    // Exclude if already sent a message
                    if (shouldExcludeSent && sentContactIds.has(normalized)) {
                        skippedCount++;
                        continue;
                    }
                    
                    const cleanNum = normalized.split('@')[0];
                    insertContact.run(normalized, c.name, cleanNum, '');
                    totalContacts++;
                    
                    if (listId && insertMember) {
                        const info = insertMember.run(listId, normalized);
                        if (info.changes > 0) associatedCount++;
                    }
                }
            }
        });
        
        transaction();
        
        res.json({
            success: true,
            parsedCount: contactsParsed.length,
            insertedPhoneNumbers: totalContacts,
            associatedCount: listId ? associatedCount : 0,
            skippedCount,
            listId,
            listName
        });
    } catch (err) {
        console.error("Import Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/contacts/search', (req, res) => {
    const { q, limit = 50 } = req.query;
    if (!q) return res.json([]);
    try {
        const results = db.prepare(`
            SELECT id, name, number, pushname 
            FROM contacts 
            WHERE name LIKE ? OR number LIKE ?
            LIMIT ?
        `).all(`%${q}%`, `%${q}%`, Number(limit));
        res.json(results);
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
    const { flowId, labelIds = [], virtualListIds = [], config } = req.body; 
    try {
        const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId);
        let allContacts = [];
        
        // 1. WhatsApp native labels
        for (const labelId of labelIds) {
            const contacts = await getContactsByLabel(labelId);
            // Inyectamos el labelId original en cada contacto para saber de dónde sacarlo luego
            const contactsWithLabel = contacts.map(c => ({ ...c, sourceLabelId: labelId }));
            allContacts = [...allContacts, ...contactsWithLabel];
        }
        
        // 2. Local Virtual Lists
        for (const listId of virtualListIds) {
            const members = db.prepare(`
                SELECT contacts.id, contacts.name, contacts.number, contacts.pushname 
                FROM virtual_list_members 
                JOIN contacts ON virtual_list_members.contact_id = contacts.id 
                WHERE virtual_list_members.list_id = ?
            `).all(listId);
            
            const contactsFromList = members.map(m => ({
                id: { _serialized: m.id, user: m.number },
                name: m.name,
                number: m.number,
                pushname: m.pushname,
                sourceVirtualListId: listId
            }));
            
            allContacts = [...allContacts, ...contactsFromList];
        }
        
        const uniqueContacts = Array.from(new Map(allContacts.map(c => [c.id._serialized, c])).values());
        
        const labelNames = [];
        if (labelIds.length > 0) {
            labelNames.push(...labelIds);
        }
        if (virtualListIds.length > 0) {
            // Obtener nombres de listas virtuales
            const lists = db.prepare(`SELECT name FROM virtual_lists WHERE id IN (${virtualListIds.map(() => '?').join(',')})`).all(...virtualListIds);
            labelNames.push(...lists.map(l => `[V] ${l.name}`));
        }
        
        const campaignLabel = labelNames.join(', ');
        const campaign = db.prepare('INSERT INTO campaigns (flow_id, label, total_count) VALUES (?, ?, ?)')
            .run(flowId, campaignLabel, uniqueContacts.length);
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
            if (config.autoRemove) {
                if (contact.sourceLabelId) {
                    db.prepare('DELETE FROM label_members WHERE label_id = ? AND contact_id = ?').run(contact.sourceLabelId, contact.id._serialized);
                }
                if (contact.sourceVirtualListId) {
                    db.prepare('DELETE FROM virtual_list_members WHERE list_id = ? AND contact_id = ?').run(contact.sourceVirtualListId, contact.id._serialized);
                }
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
