const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');

let client = null;
let io = null;
let currentStatus = 'DESCONECTADO';
let lastQr = null;
let lastPairingCode = null;
let isSyncing = false;

const initWhatsApp = (socketIo) => {
    io = socketIo;
    console.log('--- WHATSAPP MODULE READY ---');
};

const getStatus = () => ({
    status: currentStatus,
    qr: lastQr,
    pairingCode: lastPairingCode,
    isSyncing
});

const startClient = async () => {
    if (client) return; // Ya esta intentando o conectado

    currentStatus = 'INICIANDO';
    lastQr = null;
    lastPairingCode = null;
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
        lastPairingCode = null;
        currentStatus = 'ESPERANDO ESCANEO';
        console.log('--- QR RECEIVED ---');
        if (io) {
            io.emit('qr', qr);
            io.emit('status', currentStatus);
        }
    });

    client.on('code', (code) => {
        lastPairingCode = code;
        console.log('--- PAIRING CODE RECEIVED:', code, '---');
        if (io) {
            io.emit('pairing_code', code);
            io.emit('status', currentStatus);
        }
    });

    client.on('ready', async () => {
        currentStatus = 'BOT ONLINE';
        lastQr = null;
        lastPairingCode = null;
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
        lastPairingCode = null;
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
        lastPairingCode = null;
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
    let targetId = to;
    try {
        if (media) {
            return await client.sendMessage(targetId, MessageMedia.fromFilePath(media), { caption: content });
        }
        return await client.sendMessage(targetId, content);
    } catch (err) {
        if (err.message && err.message.includes('No LID')) {
            try {
                const numberId = await client.getNumberId(to);
                if (numberId && numberId._serialized) {
                    targetId = numberId._serialized;
                    if (media) {
                        return await client.sendMessage(targetId, MessageMedia.fromFilePath(media), { caption: content });
                    }
                    return await client.sendMessage(targetId, content);
                }
            } catch (retryErr) {}
            throw new Error('El número no está registrado en WhatsApp o es inválido (No LID)');
        }
        throw err;
    }
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
    console.log("[LABELS SYNC] Iniciando sincronización profunda...");
    try {
        // 1. Obtener todos los chats de la sesión para forzar la carga de metadatos en la memoria del navegador
        const allChats = await client.getChats();
        console.log(`[LABELS SYNC] Sincronizados ${allChats.length} chats en memoria del navegador.`);

        const labels = await client.getLabels();
        for (const label of labels) {
            try {
                const chats = await label.getChats();
                console.log(`[LABELS SYNC] Leídos ${chats.length} chats para etiqueta "${label.name}".`);
                
                // 2. Solo limpiamos y re-insertamos si la API devolvió al menos 1 miembro.
                // Esto previene que una falla temporal de carga en el navegador borre la caché de la DB.
                if (chats && chats.length > 0) {
                    db.prepare('DELETE FROM label_members WHERE label_id = ?').run(label.id);
                    
                    for (const chat of chats) {
                        db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(chat.id._serialized, chat.name || '', chat.id.user);
                        db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(label.id, chat.id._serialized);
                    }
                    console.log(`[LABELS SYNC] Guardados ${chats.length} miembros para etiqueta "${label.name}" en SQLite.`);
                } else {
                    console.log(`[LABELS SYNC] Manteniendo caché local para "${label.name}" (API reportó 0 miembros).`);
                }
            } catch (err) {
                console.error(`[LABELS SYNC] Error en etiqueta "${label.name || label.id}":`, err.message);
            }
        }
        return labels;
    } catch (e) {
        console.error("[LABELS SYNC] Error fatal en syncLabelsAndMembers:", e.message);
        return [];
    }
};

const sanitizePairingNumber = (raw) => {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.substring(2);
    if (digits.startsWith('0')) digits = digits.substring(1);
    
    if (digits.startsWith('54')) {
        if (digits.startsWith('54915')) {
            digits = '549' + digits.substring(5);
        } else if (digits.startsWith('5415')) {
            digits = '549' + digits.substring(4);
        } else if (!digits.startsWith('549')) {
            if (digits.length === 12) {
                digits = '549' + digits.substring(2);
            }
        }
    } else {
        if (digits.length === 10) {
            digits = '549' + digits;
        } else if (digits.startsWith('15') && digits.length === 11) {
            digits = '549' + digits.substring(2);
        } else if (digits.includes('15') && digits.length >= 11 && digits.length <= 13) {
            const idx = digits.indexOf('15');
            if (idx > 0 && idx < 5) {
                const without15 = digits.substring(0, idx) + digits.substring(idx + 2);
                if (without15.length === 10) {
                    digits = '549' + without15;
                }
            }
        } else if (digits.length === 11 && digits.startsWith('9')) {
            digits = '54' + digits;
        }
    }
    return digits;
};

const requestPairingCode = async (phoneNumber) => {
    const cleanNumber = sanitizePairingNumber(phoneNumber);
    if (!cleanNumber || cleanNumber.length < 8) {
        throw new Error('Número de teléfono inválido. Ingrese código de país y número (ej: 11 2345 6789 o 5491123456789).');
    }

    console.log(`[PAIRING] Solicitando código de vinculación para: ${cleanNumber}`);

    if (!client) {
        startClient();
    }

    // Esperar a que el navegador de WhatsApp Web esté completamente cargado y con los módulos listos
    const maxWaitMs = 30000;
    const startTime = Date.now();
    let isReady = false;

    while (Date.now() - startTime < maxWaitMs) {
        if (client && client.pupPage) {
            try {
                isReady = await client.pupPage.evaluate(() => {
                    return typeof window.AuthStore !== 'undefined' && 
                           typeof window.AuthStore.PairingCodeLinkUtils !== 'undefined' &&
                           typeof window.require === 'function';
                });
                if (isReady) break;
            } catch (e) {
                // El navegador puede estar navegando o cargando recursos
            }
        }
        await new Promise(r => setTimeout(r, 500));
    }

    if (!client || !client.pupPage || !isReady) {
        throw new Error('El navegador de WhatsApp aún está iniciando sus servicios. Por favor aguardá 10 segundos y volvé a presionar "Generar Código".');
    }

    try {
        const result = await client.pupPage.evaluate(async (cleanPhone) => {
            const utils = window.AuthStore?.PairingCodeLinkUtils;
            if (!utils) {
                return { ok: false, error: 'Módulo de vinculación no disponible. Aguarde unos segundos y reintente.' };
            }
            try {
                utils.setPairingType('ALT_DEVICE_LINKING');
                await utils.initializeAltDeviceLinking();
                const code = await utils.startAltLinkingFlow(cleanPhone, true);
                return { ok: true, code };
            } catch (e) {
                const isRateLimit = e.name === 'CompanionHelloError' || 
                                    e.type?.name === 'IQErrorRateOverlimit' || 
                                    e.type?.value?.code === 429 || 
                                    e.type?.value?.text === 'rate-overlimit';
                if (isRateLimit) {
                    return { 
                        ok: false, 
                        rateLimit: true,
                        error: 'WhatsApp limitó temporalmente las solicitudes para este número (límite de intentos alcanzado). Esperá unos 5-10 minutos antes de volver a solicitar un código para este teléfono, o vinculá con el Código QR.' 
                    };
                }
                const msg = (e.message && e.message !== 't') ? e.message : (e.name || 'Error en WhatsApp Web al generar código.');
                return { ok: false, error: msg };
            }
        }, cleanNumber);

        if (!result.ok) {
            console.error('[PAIRING ERROR]:', result.error);
            throw new Error(result.error);
        }

        const code = result.code;
        lastPairingCode = code;
        console.log(`[PAIRING] Código generado exitosamente: ${code}`);
        if (io) {
            io.emit('pairing_code', code);
        }
        return { success: true, code, phoneNumber: cleanNumber };
    } catch (err) {
        console.error('[PAIRING EXCEPTION]:', err.message);
        throw new Error(err.message || 'Error al comunicarse con WhatsApp Web para generar el código.');
    }
};

const cancelPairingCode = async () => {
    lastPairingCode = null;
    if (client && client.pupPage) {
        try {
            await client.pupPage.evaluate(() => {
                if (window.codeInterval) {
                    clearInterval(window.codeInterval);
                    window.codeInterval = undefined;
                }
                if (typeof window.AuthStore !== 'undefined' && window.AuthStore.PairingCodeLinkUtils) {
                    try {
                        window.AuthStore.PairingCodeLinkUtils.setPairingType('QR');
                    } catch (e) {}
                }
            });
        } catch (e) {
            console.error('Error al cancelar código:', e.message);
        }
    }
    return { success: true };
};

const debugPairingState = async () => {
    if (!client) return { hasClient: false, status: currentStatus };
    if (!client.pupPage) return { hasClient: true, hasPupPage: false, status: currentStatus };
    try {
        const evalInfo = await client.pupPage.evaluate(() => {
            return {
                url: window.location.href,
                hasRequire: typeof window.require,
                hasAuthStore: typeof window.AuthStore,
                hasPairingUtils: typeof window.AuthStore?.PairingCodeLinkUtils,
                hasDebug: typeof window.Debug,
                authStoreKeys: window.AuthStore ? Object.keys(window.AuthStore) : null
            };
        });
        return { hasClient: true, hasPupPage: true, status: currentStatus, evalInfo };
    } catch (e) {
        return { hasClient: true, hasPupPage: true, status: currentStatus, error: e.message };
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
    syncLabelsAndMembers,
    requestPairingCode,
    cancelPairingCode,
    debugPairingState,
    sanitizePairingNumber
};
