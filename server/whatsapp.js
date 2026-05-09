const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');

let client = null;
let io = null;
let currentStatus = 'DESCONECTADO';
let lastQr = null;
let isSyncing = false;

const initWhatsApp = (socketIo) => {
    io = socketIo;
    console.log('--- WHATSAPP MODULE READY ---');
};

const getStatus = () => ({
    status: currentStatus,
    qr: lastQr,
    isSyncing
});

const startClient = async () => {
    if (client) return; // Ya esta intentando o conectado

    currentStatus = 'INICIANDO';
    lastQr = null;
    if (io) io.emit('status', currentStatus);

    console.log('--- STARTING WHATSAPP CLIENT ---');
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './sessions' }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', (qr) => {
        lastQr = qr;
        currentStatus = 'ESPERANDO ESCANEO';
        console.log('--- QR RECEIVED ---');
        if (io) {
            io.emit('qr', qr);
            io.emit('status', currentStatus);
        }
    });

    client.on('ready', async () => {
        currentStatus = 'BOT ONLINE';
        lastQr = null;
        console.log('--- CLIENT READY ---');
        if (io) {
            io.emit('ready', true);
            io.emit('status', currentStatus);
        }
        
        // Carga inicial de etiquetas
        try {
            const labels = await client.getLabels();
            if (io) io.emit('labels', labels);
        } catch (e) {}
    });

    client.on('disconnected', () => {
        currentStatus = 'DESCONECTADO';
        lastQr = null;
        console.log('--- DISCONNECTED ---');
        if (io) io.emit('status', currentStatus);
        client = null;
    });

    try {
        await client.initialize();
    } catch (err) {
        console.error('Init Error:', err);
        currentStatus = 'DESCONECTADO';
        if (io) io.emit('status', currentStatus);
        client = null;
    }
};

const stopClient = async () => {
    if (client) {
        try { await client.destroy(); } catch (e) {}
        client = null;
        currentStatus = 'DESCONECTADO';
        lastQr = null;
        if (io) io.emit('status', currentStatus);
    }
};

const logout = async () => {
    await stopClient();
    const sessionPath = path.join(__dirname, 'sessions');
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    return { success: true };
};

const getLabels = async () => {
    if (!client || currentStatus !== 'BOT ONLINE') return [];
    try { return await client.getLabels(); } catch (e) { return []; }
};

const getContactsByLabel = async (labelId) => {
    // Primero intentamos por base de datos local para tener TODO lo conocido
    const localMembers = db.prepare('SELECT contact_id FROM label_members WHERE label_id = ?').all(labelId);
    
    // Si no hay nada local, o para asegurar, intentamos API
    if (!client) return localMembers.map(m => ({ id: { _serialized: m.contact_id } }));

    try {
        const label = await client.getLabelById(labelId);
        const chats = await label.getChats();
        
        // Actualizamos nuestra DB con lo que la API ve ahora
        for (const chat of chats) {
            db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(labelId, chat.id._serialized);
        }
        
        // Devolvemos la unión de local + lo que ve la API ahora
        const combinedIds = new Set([
            ...localMembers.map(m => m.contact_id),
            ...chats.map(c => c.id._serialized)
        ]);
        
        return Array.from(combinedIds).map(id => ({ id: { _serialized: id } }));
    } catch (e) { 
        return localMembers.map(m => ({ id: { _serialized: m.contact_id } }));
    }
};

const syncAllContacts = async () => {
    if (!client || isSyncing) return;
    isSyncing = true;
    if (io) io.emit('sync_status', { isSyncing: true, progress: 0 });

    try {
        const contacts = await client.getContacts();
        let processed = 0;
        
        for (const contact of contacts) {
            // Guardar contacto básico
            db.prepare(`
                INSERT OR REPLACE INTO contacts (id, name, number, pushname) 
                VALUES (?, ?, ?, ?)
            `).run(contact.id._serialized, contact.name || contact.pushname, contact.number, contact.pushname);

            // Intentar obtener etiquetas del chat (esto es lo lento)
            // Solo lo hacemos para chats que existan o para todos si queremos profundidad
            // Por ahora solo guardamos el contacto, el mapeo de etiquetas se puede hacer bajo demanda o en un paso extra
            processed++;
            if (processed % 20 === 0 && io) {
                io.emit('sync_status', { isSyncing: true, progress: Math.floor((processed / contacts.length) * 100) });
            }
        }
    } catch (e) { console.error("Sync Error:", e); }
    
    isSyncing = false;
    if (io) io.emit('sync_status', { isSyncing: false, progress: 100 });
};

const tagContactsByQuery = async (query, labelId, limit = 200) => {
    console.log(`[TAGGING] Iniciando búsqueda: "${query}" | Límite: ${limit}`);
    if (!client || currentStatus !== 'BOT ONLINE') {
        console.error("[TAGGING] Error: Bot no está listo o desconectado");
        throw new Error('Bot desconectado o no iniciado');
    }
    
    try {
        const contacts = await client.getContacts();
        console.log(`[TAGGING] Total contactos en agenda: ${contacts.length}`);
        
        const matches = contacts.filter(c => {
            const name = (c.name || c.pushname || '').toLowerCase();
            return name.includes(query.toLowerCase());
        }).slice(0, limit);

        console.log(`[TAGGING] Contactos que coinciden: ${matches.length}`);
        let successCount = 0;

        for (const contact of matches) {
            try {
                // Asegurar que el contacto existe en nuestra DB antes de etiquetarlo
                db.prepare(`
                    INSERT OR REPLACE INTO contacts (id, name, number, pushname) 
                    VALUES (?, ?, ?, ?)
                `).run(contact.id._serialized, contact.name || contact.pushname, contact.number, contact.pushname);

                const chat = await contact.getChat();
                await chat.changeLabels([labelId]);
                
                // Actualizar localmente la relación
                db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(labelId, contact.id._serialized);
                
                successCount++;
                if (io) io.emit('tag_progress', { current: successCount, total: matches.length, status: 'running' });
            } catch (e) {
                console.error(`Error tagging ${contact.id._serialized}:`, e);
            }
        }

        if (io) io.emit('tag_progress', { current: successCount, total: matches.length, status: 'finished' });
        console.log(`[TAGGING] Finalizado: ${successCount} contactos etiquetados.`);
        
    } catch (err) {
        console.error("[TAGGING] Error fatal:", err);
        if (io) io.emit('tag_progress', { status: 'error', message: err.message });
    }
};

const sendMessage = async (to, content, media = null) => {
    if (!client) throw new Error('Bot apagado');
    if (media) {
        return await client.sendMessage(to, MessageMedia.fromFilePath(media), { caption: content });
    }
    return await client.sendMessage(to, content);
};

module.exports = { initWhatsApp, startClient, stopClient, logout, getLabels, getContactsByLabel, syncAllContacts, tagContactsByQuery, sendMessage, getStatus };
