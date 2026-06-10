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
            db.prepare(`
                INSERT OR REPLACE INTO contacts (id, name, number, pushname) 
                VALUES (?, ?, ?, ?)
            `).run(contact.id._serialized, contact.name || contact.pushname, contact.number, contact.pushname);
            processed++;
            if (processed % 20 === 0 && io) {
                io.emit('sync_status', { isSyncing: true, progress: Math.floor((processed / contacts.length) * 100) });
            }
        }
    } catch (e) { console.error("Sync Error:", e); }
    
    isSyncing = false;
    if (io) io.emit('sync_status', { isSyncing: false, progress: 100 });
};

const deepSyncLabels = async () => {
    if (!client || isSyncing) return;
    isSyncing = true;
    console.log("[DEEP SYNC] Iniciando sincronización profunda de etiquetas...");
    if (io) io.emit('sync_status', { isSyncing: true, progress: 0, type: 'labels' });

    try {
        const labels = await client.getLabels();
        let labelIndex = 0;

        for (const label of labels) {
            console.log(`[DEEP SYNC] Procesando etiqueta: ${label.name}`);
            const chats = await label.getChats();
            for (const chat of chats) {
                // Guardar relación
                db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(label.id, chat.id._serialized);
                // También guardar contacto básico si no existe
                db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(chat.id._serialized, chat.name, chat.id.user);
            }
            labelIndex++;
            if (io) io.emit('sync_status', { isSyncing: true, progress: Math.floor((labelIndex / labels.length) * 100), type: 'labels' });
        }
    } catch (e) { console.error("Deep Sync Error:", e); }

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
        
        // Obtener IDs de contactos que ya tienen envíos exitosos para excluirlos
        const sentLogs = db.prepare("SELECT DISTINCT contact_id FROM logs WHERE status = 'sent'").all();
        const sentContactIds = new Set(sentLogs.map(l => l.contact_id));
        
        const matches = contacts.filter(c => {
            // EXCLUIR SI YA SE LE ENVIÓ
            if (sentContactIds.has(c.id._serialized)) {
                return false;
            }
            
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

let activeSearch = null;

const getActiveSearch = () => activeSearch;

const searchMessagesInHistory = async (query, chatLimit = 100, messageLimit = 50) => {
    if (!client || currentStatus !== 'BOT ONLINE') {
        throw new Error('El bot de WhatsApp no está conectado o iniciado.');
    }
    
    if (activeSearch && activeSearch.status === 'running') {
        throw new Error('Ya hay una búsqueda de mensajes en curso.');
    }

    activeSearch = { status: 'running', query, progress: 0 };
    console.log(`[SEARCH] Iniciando búsqueda segura de "${query}" | Chats limit: ${chatLimit} | Msg limit: ${messageLimit}`);
    
    try {
        const chats = await client.getChats();
        const limitNum = chatLimit === 'all' || !chatLimit ? chats.length : Number(chatLimit);
        const chatsToSearch = chats.slice(0, limitNum);
        const total = chatsToSearch.length;
        let current = 0;
        let matchCount = 0;

        if (io) io.emit('search_status', { status: 'running', query, current, total, matches: 0 });

        for (const chat of chatsToSearch) {
            if (!activeSearch || activeSearch.status === 'cancelled') {
                console.log('[SEARCH] Búsqueda cancelada.');
                if (io) io.emit('search_status', { status: 'cancelled' });
                return;
            }

            try {
                const messages = await chat.fetchMessages({ limit: Number(messageLimit) });
                const matchingMessages = messages.filter(msg => 
                    msg.body && msg.body.toLowerCase().includes(query.toLowerCase())
                );

                if (matchingMessages.length > 0) {
                    const match = {
                        id: chat.id._serialized,
                        name: chat.name,
                        matchCount: matchingMessages.length,
                        messages: matchingMessages.map(m => ({
                            body: m.body,
                            timestamp: m.timestamp * 1000,
                            fromMe: m.fromMe,
                            author: m.author || m.from
                        }))
                    };
                    matchCount++;
                    if (io) io.emit('search_match', match);
                }
            } catch (err) {
                console.error(`[SEARCH] Error en chat ${chat.name || chat.id._serialized}:`, err.message);
            }

            current++;
            if (current % 5 === 0 || current === total) {
                if (io) io.emit('search_progress', { current, total, matches: matchCount, status: 'running' });
            }

            // Micro-delay de 70ms para mantener el CPU fresco y evitar rate limiting de WhatsApp
            await new Promise(r => setTimeout(r, 70));
        }

        activeSearch = { status: 'finished', query };
        if (io) io.emit('search_status', { status: 'finished', matches: matchCount });
        console.log(`[SEARCH] Búsqueda finalizada. Matches: ${matchCount}`);
    } catch (err) {
        console.error('[SEARCH] Error fatal:', err);
        activeSearch = { status: 'error', error: err.message };
        if (io) io.emit('search_status', { status: 'error', error: err.message });
    }
};

const cancelSearch = async () => {
    if (activeSearch && activeSearch.status === 'running') {
        activeSearch.status = 'cancelled';
        console.log('[SEARCH] Solicitada cancelación de búsqueda.');
        return true;
    }
    return false;
};

const bulkTagChats = async (chatIds, labelId) => {
    if (!client) throw new Error('El bot está desconectado.');
    console.log(`[BULK TAG] Asignando etiqueta ${labelId} a ${chatIds.length} chats...`);
    
    let successCount = 0;
    
    // Obtener IDs de contactos que ya tienen envíos exitosos para excluirlos
    const sentLogs = db.prepare("SELECT DISTINCT contact_id FROM logs WHERE status = 'sent'").all();
    const sentContactIds = new Set(sentLogs.map(l => l.contact_id));

    for (const chatId of chatIds) {
        if (sentContactIds.has(chatId)) {
            console.log(`[BULK TAG] Saltando ${chatId} porque ya se le envió un mensaje.`);
            continue;
        }
        try {
            const chat = await client.getChatById(chatId);
            await chat.changeLabels([labelId]);
            
            // Guardar contacto en DB local si no está
            db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(
                chatId,
                chat.name,
                chat.id.user
            );
            
            // Guardar relación localmente
            db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(
                labelId,
                chatId
            );
            
            successCount++;
            if (io) io.emit('bulk_tag_progress', { current: successCount, total: chatIds.length, status: 'running' });
        } catch (e) {
            console.error(`[BULK TAG] Error en chat ${chatId}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 80));
    }
    
    if (io) io.emit('bulk_tag_progress', { current: successCount, total: chatIds.length, status: 'finished' });
    return successCount;
};

const syncLabelsAndMembers = async () => {
    if (!client || currentStatus !== 'BOT ONLINE') return [];
    console.log("[LABELS SYNC] Sincronizando etiquetas y miembros desde WhatsApp Web...");
    try {
        const labels = await client.getLabels();
        for (const label of labels) {
            try {
                const chats = await label.getChats();
                
                // Limpiar miembros locales para esta etiqueta específica y re-insertar
                db.prepare('DELETE FROM label_members WHERE label_id = ?').run(label.id);
                
                for (const chat of chats) {
                    db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(label.id, chat.id._serialized);
                    db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(chat.id._serialized, chat.name || '', chat.id.user);
                }
                console.log(`[LABELS SYNC] Sincronizada etiqueta "${label.name}" con ${chats.length} chats.`);
            } catch (err) {
                console.error(`[LABELS SYNC] Error sincronizando etiqueta ${label.name || label.id}:`, err.message);
            }
        }
        return labels;
    } catch (e) {
        console.error("[LABELS SYNC] Error fatal en syncLabelsAndMembers:", e.message);
        return [];
    }
};

module.exports = { 
    initWhatsApp, 
    startClient, 
    stopClient, 
    logout, 
    getLabels, 
    getContactsByLabel, 
    syncAllContacts, 
    deepSyncLabels, 
    tagContactsByQuery, 
    sendMessage, 
    getStatus,
    searchMessagesInHistory,
    cancelSearch,
    bulkTagChats,
    getActiveSearch,
    syncLabelsAndMembers
};

