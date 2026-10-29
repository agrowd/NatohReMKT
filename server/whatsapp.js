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
let isStartingClient = false;
let isStoppingClient = false;
let currentInstanceId = 0;
let activePairingPromise = null;
let currentPairingPhone = null;
let lastPairingCodeTime = 0;

const cleanChromiumLocks = () => {
    try {
        const sessionDir = path.join(__dirname, 'sessions');
        const sDir = path.join(sessionDir, 'session');
        const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];
        for (const file of lockFiles) {
            const fPath = path.join(sDir, file);
            if (fs.existsSync(fPath)) {
                try { fs.unlinkSync(fPath); } catch (e) {}
            }
        }
    } catch (e) {}
};

const terminateClient = async () => {
    if (client) {
        try {
            client.removeAllListeners();
            const browser = client.pupBrowser;
            const proc = browser ? browser.process() : null;
            if (browser) {
                try {
                    await Promise.race([
                        client.destroy().catch(() => {}),
                        new Promise(r => setTimeout(r, 2000))
                    ]);
                } catch (e) {}
            }
            if (proc && !proc.killed) {
                try { proc.kill('SIGKILL'); } catch (e) {}
            }
        } catch (e) {}
        client = null;
    }

    if (process.platform === 'linux') {
        try {
            const { execSync } = require('child_process');
            execSync('pkill -9 -f "sessions/session" || true');
        } catch (e) {}
    }

    cleanChromiumLocks();
    await new Promise(r => setTimeout(r, 600));
};

const initWhatsApp = async (socketIo) => {
    io = socketIo;
    console.log('--- WHATSAPP MODULE READY ---');
    await terminateClient();
    const sessionDir = path.join(__dirname, 'sessions');
    if (fs.existsSync(sessionDir)) {
        console.log('--- RESTAURANDO SESIÓN PREVIA AUTOMÁTICAMENTE ---');
        try {
            await startClient();
        } catch (e) {
            console.error('Error al auto-restaurar sesión:', e.message);
        }
    }
};

// Parche automático en runtime para Puppeteer 24 Frame Swap Timeout & Detached Frame bugs
try {
    const fmPath = path.join(__dirname, 'node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/FrameManager.js');
    if (fs.existsSync(fmPath)) {
        let content = fs.readFileSync(fmPath, 'utf8');
        let fmChanged = false;
        if (content.includes('TIME_FOR_WAITING_FOR_SWAP = 100;')) {
            content = content.replace('TIME_FOR_WAITING_FOR_SWAP = 100;', 'TIME_FOR_WAITING_FOR_SWAP = 10000;');
            fmChanged = true;
            console.log('[PUPPETEER PATCH] TIME_FOR_WAITING_FOR_SWAP ampliado a 10000ms');
        }
        if (content.includes('this.#removeFramesRecursively(mainFrame);') && !content.includes('/* patched swap catch */')) {
            content = content.replace(
                /catch\s*\{\s*this\.#removeFramesRecursively\(mainFrame\);\s*\}/,
                'catch {\n            /* patched swap catch */\n        }'
            );
            fmChanged = true;
            console.log('[PUPPETEER PATCH] mainFrame self-destruct prevented in FrameManager');
        }
        if (!content.includes('/* patched never detach main frame */')) {
            content = content.replace(
                /#removeFramesRecursively\(frame\)\s*\{/,
                '#removeFramesRecursively(frame) {\n        /* patched never detach main frame */\n        if (!frame.parentFrame()) return;'
            );
            fmChanged = true;
            console.log('[PUPPETEER PATCH] mainFrame detachment prevented in #removeFramesRecursively');
        }
        if (fmChanged) {
            fs.writeFileSync(fmPath, content);
        }
    }
    const decPath = path.join(__dirname, 'node_modules/puppeteer-core/lib/cjs/puppeteer/util/decorators.js');
    if (fs.existsSync(decPath)) {
        let decContent = fs.readFileSync(decPath, 'utf8');
        if (!decContent.includes('this.constructor.name !== "CdpFrame"')) {
            decContent = decContent.replace(
                /if\s*\(\s*this\.disposed\s*\)\s*\{\s*throw new Error\(message\(this\)\);/,
                'if (this.disposed && this.constructor.name !== "CdpFrame") {\n                throw new Error(message(this));'
            );
            fs.writeFileSync(decPath, decContent);
            console.log('[PUPPETEER PATCH] CdpFrame disposed check bypassed in throwIfDisposed');
        }
    }
    const iwPath = path.join(__dirname, 'node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/IsolatedWorld.js');
    if (fs.existsSync(iwPath)) {
        let iwContent = fs.readFileSync(iwPath, 'utf8');
        if (!iwContent.includes('/* patched iw */')) {
            iwContent = iwContent.replace(
                /if\s*\(\s*this\.disposed\s*\)\s*\{\s*throw new Error\(`Execution context is not available[^`]+`\);\s*\}/,
                '/* patched iw */\n        if (this.disposed && !this.#context) {\n            throw new Error(`Execution context is not available in detached frame or worker "${this.environment.url()}" (are you trying to evaluate?)`);\n        }'
            );
            fs.writeFileSync(iwPath, iwContent);
            console.log('[PUPPETEER PATCH] IsolatedWorld disposed check bypassed if context exists');
        }
    }
    const clientJsPath = path.join(__dirname, 'node_modules/whatsapp-web.js/src/Client.js');
    if (fs.existsSync(clientJsPath)) {
        let clientContent = fs.readFileSync(clientJsPath, 'utf8');
        if (!clientContent.includes('/* patched destroy trace */')) {
            clientContent = clientContent.replace(
                /async\s+destroy\(\)\s*\{/,
                'async destroy() {\n        /* patched destroy trace */\n        console.log("[CLIENT DESTROY CALLED FROM]:", new Error().stack);'
            );
            fs.writeFileSync(clientJsPath, clientContent);
            console.log('[WHATSAPP-WEB.JS PATCH] Added stack trace to Client.destroy()');
        }
    }
} catch (e) {
    console.error('[PUPPETEER PATCH ERROR]', e.message);
}

const getStatus = () => ({
    status: currentStatus,
    qr: lastQr,
    pairingCode: lastPairingCode,
    isSyncing
});

const startClient = async (pairingPhoneNumber = null, forceRestart = false) => {
    if (currentStatus === 'BOT ONLINE' && !forceRestart) {
        console.log('--- startClient: Bot ya se encuentra en línea. No se reinicia. ---');
        return;
    }

    if (isStartingClient) {
        console.log('--- startClient ya en ejecución, aguardando inicio previo... ---');
        while (isStartingClient) {
            await new Promise(r => setTimeout(r, 200));
        }
        return;
    }
    isStartingClient = true;
    isStoppingClient = false;
    const instanceId = ++currentInstanceId;

    try {
        await terminateClient();

        currentStatus = pairingPhoneNumber ? 'GENERANDO CÓDIGO' : 'INICIANDO';
        lastQr = null;
        lastPairingCode = null;
        if (io) io.emit('status', currentStatus);

        console.log(`--- STARTING WHATSAPP CLIENT [Instancia #${instanceId}] (Mode: ${pairingPhoneNumber ? 'Pairing Code (' + pairingPhoneNumber + ')' : 'QR Code'}) ---`);

        const sessionDir = path.join(__dirname, 'sessions');
        cleanChromiumLocks();

        const clientOptions = {
            authStrategy: new LocalAuth({ dataPath: sessionDir }),
            puppeteer: {
                headless: true,
                protocolTimeout: 60000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-features=IsolateOrigins,site-per-process,RenderDocument,BackForwardCache',
                    '--disable-site-isolation-trials'
                ]
            }
        };

        if (pairingPhoneNumber) {
            clientOptions.pairWithPhoneNumber = {
                phoneNumber: pairingPhoneNumber,
                showNotification: true,
                intervalMs: 180000
            };
        }

        client = new Client(clientOptions);

        client.on('qr', (qr) => {
            if (instanceId !== currentInstanceId || isStoppingClient || currentStatus === 'DESCONECTADO') {
                console.log(`--- QR IGNORADO (Instancia #${instanceId} obsoleta o bot detenido) ---`);
                return;
            }
            // 1. Si el bot ya está online, ignorar eventos de QR residuales
            if (currentStatus === 'BOT ONLINE') {
                console.log('--- QR IGNORADO (BOT ONLINE) ---');
                return;
            }
            // 2. Si se está en proceso de vinculación por código telefónico, NO pisar el código ni cambiar a ESPERANDO ESCANEO
            if (lastPairingCode || currentStatus === 'CÓDIGO GENERADO' || currentStatus === 'GENERANDO CÓDIGO') {
                lastQr = qr;
                console.log('--- QR EN SEGUNDO PLANO (MODO CÓDIGO ACTIVO) ---');
                return;
            }
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
            if (instanceId !== currentInstanceId || isStoppingClient || currentStatus === 'DESCONECTADO') {
                console.log(`--- CODE IGNORADO (Instancia #${instanceId} obsoleta o bot detenido) ---`);
                return;
            }
            lastPairingCode = code;
            lastPairingCodeTime = Date.now();
            currentStatus = 'CÓDIGO GENERADO';
            console.log('--- PAIRING CODE RECEIVED:', code, '---');
            if (io) {
                io.emit('pairing_code', code);
                io.emit('status', currentStatus);
            }
        });

        client.on('authenticated', () => {
            if (instanceId !== currentInstanceId || isStoppingClient || currentStatus === 'DESCONECTADO') return;
            console.log('--- CLIENT AUTHENTICATED (CÓDIGO ACEPTADO EN EL CELULAR) ---');
            currentStatus = 'CONECTANDO...';
            lastQr = null;
            lastPairingCode = null;
            currentPairingPhone = null;
            lastPairingCodeTime = 0;
            if (io) {
                io.emit('authenticated', true);
                io.emit('status', currentStatus);
            }
        });

        client.on('ready', async () => {
            if (instanceId !== currentInstanceId || isStoppingClient || currentStatus === 'DESCONECTADO') return;
            currentStatus = 'BOT ONLINE';
            lastQr = null;
            lastPairingCode = null;
            currentPairingPhone = null;
            lastPairingCodeTime = 0;
            console.log('--- CLIENT READY ---');
            if (io) {
                io.emit('ready', true);
                io.emit('status', currentStatus);
            }
            
            // Carga inicial y sincronización de etiquetas
            try {
                const labels = await syncLabelsAndMembers();
                const stats = db.prepare('SELECT label_id, COUNT(*) as count FROM label_members GROUP BY label_id').all();
                const labelsWithStats = (labels || []).map(l => {
                    const stat = stats.find(s => s.label_id === l.id);
                    return { ...l, memberCount: stat ? stat.count : 0 };
                });
                if (io) io.emit('labels', labelsWithStats);
            } catch (e) {
                console.error('[READY GETLABELS ERROR]:', e.message);
            }
        });

        client.on('change_state', (state) => {
            console.log('--- CHANGE STATE ---', state);
        });

        client.on('auth_failure', (msg) => {
            if (instanceId !== currentInstanceId) return;
            console.error('--- AUTH FAILURE ---', msg);
            currentStatus = 'DESCONECTADO';
            lastQr = null;
            lastPairingCode = null;
            currentPairingPhone = null;
            lastPairingCodeTime = 0;
            if (io) io.emit('status', currentStatus);
            client = null;
        });

        client.on('disconnected', (reason) => {
            if (instanceId !== currentInstanceId) return;
            currentStatus = 'DESCONECTADO';
            lastQr = null;
            lastPairingCode = null;
            currentPairingPhone = null;
            lastPairingCodeTime = 0;
            console.log('--- DISCONNECTED ---', reason);
            if (io) io.emit('status', currentStatus);
            client = null;
        });

        try {
            await client.initialize();
            if (client && client.pupBrowser) {
                const proc = client.pupBrowser.process ? client.pupBrowser.process() : null;
                console.log(`[BROWSER] pupBrowser ready, PID: ${proc ? proc.pid : 'unknown'}`);
                if (proc) {
                    proc.on('exit', (code, sig) => {
                        console.log(`[BROWSER EXIT] Chromium process exited with code: ${code}, signal: ${sig}`);
                    });
                    if (proc.stderr) {
                        proc.stderr.on('data', (d) => {
                            console.log(`[BROWSER STDERR]: ${d.toString().trim()}`);
                        });
                    }
                }
                client.pupBrowser.on('disconnected', () => {
                    console.log('[BROWSER EVENT] pupBrowser emitted "disconnected"');
                });
            }
        } catch (err) {
            console.error('Init Error:', err.message || err);
            if (instanceId === currentInstanceId && !isStoppingClient) {
                currentStatus = 'DESCONECTADO';
                if (io) io.emit('status', currentStatus);
                client = null;
            }
        }
    } finally {
        if (instanceId === currentInstanceId) {
            isStartingClient = false;
        }
    }
};

const stopClient = async () => {
    console.log('--- STOPPING WHATSAPP CLIENT (DETENCIÓN MANUAL FORZADA) ---');
    isStoppingClient = true;
    currentInstanceId++; // Invalida cualquier evento pendiente de instancias anteriores
    currentStatus = 'DESCONECTADO';
    lastQr = null;
    lastPairingCode = null;
    currentPairingPhone = null;
    lastPairingCodeTime = 0;
    activePairingPromise = null;

    if (io) {
        io.emit('status', 'DESCONECTADO');
        io.emit('qr', null);
        io.emit('pairing_code', null);
    }

    await terminateClient();
    isStartingClient = false;
    isStoppingClient = false;
    console.log('--- WHATSAPP CLIENT COMPLETAMENTE DETENIDO ---');
    return { success: true, status: 'DESCONECTADO', message: 'Bot detenido y procesos cerrados correctamente' };
};

const restartClient = async () => {
    console.log('--- REINICIANDO CLIENTE DE WHATSAPP ---');
    await stopClient();
    await startClient(null, true);
    return { success: true, message: 'Bot reiniciado con éxito' };
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

const getFavoriteChatsFromWhatsApp = async () => {
    if (!client || currentStatus !== 'BOT ONLINE') return [];
    try {
        const evalCode = `(() => {
            const collections = window.require('WAWebCollections') || {};
            const favCol = collections.FavoriteCollection;
            const favModels = favCol ? favCol.getModelsArray() : [];
            const chatCol = collections.Chat;
            const contactCol = collections.Contact;

            const allChats = chatCol ? chatCol.getModelsArray() : [];
            const allContacts = contactCol ? contactCol.getModelsArray() : [];

            return favModels.map(f => {
                const fid = f.id ? (f.id._serialized || f.id) : (f.__x_id ? (f.__x_id._serialized || f.__x_id) : String(f));
                
                let c = chatCol ? chatCol.get(fid) : null;
                if (!c && chatCol) {
                    c = allChats.find(chat => {
                        const idStr = chat.id ? (chat.id._serialized || chat.id) : '';
                        const lidStr = chat.lid ? (chat.lid._serialized || chat.lid) : (chat.__x_lid ? (chat.__x_lid._serialized || chat.__x_lid) : '');
                        return idStr === fid || lidStr === fid;
                    });
                }

                let ct = contactCol ? contactCol.get(fid) : null;
                if (!ct && contactCol) {
                    ct = allContacts.find(contact => {
                        const idStr = contact.id ? (contact.id._serialized || contact.id) : '';
                        const lidStr = contact.lid ? (contact.lid._serialized || contact.lid) : (contact.__x_lid ? (contact.__x_lid._serialized || contact.__x_lid) : '');
                        return idStr === fid || lidStr === fid;
                    });
                }

                const name = (c && (c.name || c.formattedTitle)) || (ct && (ct.name || ct.pushname)) || '';
                const phoneObj = (ct && ct.phoneNumber) || (c && c.phoneNumber) || null;
                const phoneNum = phoneObj ? (phoneObj.user || (phoneObj._serialized ? phoneObj._serialized.split('@')[0] : '')) : (fid.includes('@') ? fid.split('@')[0] : fid);

                return {
                    id: fid,
                    name: name,
                    number: phoneNum
                };
            });
        })()`;

        let favs = null;
        if (client.pupBrowser) {
            const pageTarget = client.pupBrowser.targets().find(t => t.type() === 'page' && t.url().includes('whatsapp.com'));
            if (pageTarget) {
                const session = typeof pageTarget._session === 'function' ? pageTarget._session() : null;
                if (session) {
                    const res = await session.send('Runtime.evaluate', {
                        expression: evalCode,
                        returnByValue: true,
                        awaitPromise: true
                    });
                    if (res && res.result && res.result.value) {
                        favs = res.result.value;
                    }
                }
            }
        }

        if (!favs && client.pupPage && !client.pupPage.isClosed()) {
            favs = await client.pupPage.evaluate(new Function(`return ${evalCode}`));
        }

        return favs || [];
    } catch (e) {
        console.error('[GET FAVORITES ERROR]:', e.message);
        return [];
    }
};

const getContactsByLabel = async (labelId) => {
    // Primero intentamos por base de datos local para tener TODO lo conocido
    const localMembers = db.prepare('SELECT contact_id FROM label_members WHERE label_id = ?').all(labelId);
    
    // Si no hay cliente o no está online, devolvemos la DB local
    if (!client || currentStatus !== 'BOT ONLINE') {
        return localMembers.map(m => ({ id: { _serialized: m.contact_id } }));
    }

    try {
        let chats = [];
        const isFavorite = (String(labelId) === '2');
        if (isFavorite) {
            const favChats = await getFavoriteChatsFromWhatsApp();
            if (favChats && favChats.length > 0) {
                chats = favChats.map(f => ({
                    id: { _serialized: f.id, user: f.number },
                    name: f.name
                }));
            }
        } else {
            const label = await client.getLabelById(labelId);
            if (label) chats = await label.getChats();
        }
        
        // Actualizamos nuestra DB con lo que la API ve ahora
        if (chats && chats.length > 0) {
            for (const chat of chats) {
                const chatId = chat.id ? (chat.id._serialized || chat.id) : null;
                const chatNumber = chat.id && chat.id.user ? chat.id.user : (chatId ? chatId.split('@')[0] : '');
                if (chatId) {
                    db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(chatId, chat.name || '', chatNumber);
                    db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(labelId, chatId);
                }
            }
        }
        
        // Devolvemos la unión de local + lo que ve la API ahora
        const combinedIds = new Set([
            ...localMembers.map(m => m.contact_id),
            ...chats.map(c => (c.id ? (c.id._serialized || c.id) : c))
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
            const isFavorite = (String(label.id) === '2' || (label.name && label.name.toLowerCase().includes('favorit')));
            let chats = [];
            if (isFavorite) {
                const favChats = await getFavoriteChatsFromWhatsApp();
                chats = favChats.map(f => ({
                    id: { _serialized: f.id, user: f.number },
                    name: f.name
                }));
            } else {
                chats = await label.getChats();
            }
            for (const chat of chats) {
                const chatId = chat.id ? (chat.id._serialized || chat.id) : null;
                const chatNumber = chat.id && chat.id.user ? chat.id.user : (chatId ? chatId.split('@')[0] : '');
                if (chatId) {
                    db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(chatId, chat.name || '', chatNumber);
                    db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(label.id, chatId);
                }
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

const normalizePhoneRecipient = (raw) => {
    if (!raw) return raw;
    let target = String(raw).trim();
    if (target.endsWith('@lid') || target.endsWith('@g.us')) return target;
    let numOnly = target.includes('@') ? target.split('@')[0] : target;
    let digits = numOnly.replace(/\D/g, '');
    if (!digits) return target;

    if (digits.startsWith('00')) digits = digits.substring(2);
    while (digits.startsWith('0')) digits = digits.substring(1);

    if (digits.startsWith('54')) {
        let rest = digits.substring(2);
        if (rest.startsWith('9')) rest = rest.substring(1);
        if (rest.startsWith('15')) rest = rest.substring(2);
        else if (rest.includes('15')) {
            const idx = rest.indexOf('15');
            if (idx >= 2 && idx <= 4) {
                rest = rest.substring(0, idx) + rest.substring(idx + 2);
            }
        }
        if (rest.startsWith('1111')) rest = rest.substring(2);
        if (rest.length === 8 && !rest.startsWith('11')) rest = '11' + rest;
        return '549' + rest + '@c.us';
    }

    if (digits.startsWith('15')) {
        let rest = digits.substring(2);
        if (rest.startsWith('1111')) rest = rest.substring(2);
        if (rest.length === 8 && !rest.startsWith('11')) return '54911' + rest + '@c.us';
        if (rest.length === 8 && rest.startsWith('11')) return '549' + rest + '@c.us';
        if (rest.length === 10) return '549' + rest + '@c.us';
        return '549' + rest + '@c.us';
    }

    if (digits.includes('15')) {
        const idx = digits.indexOf('15');
        if (idx >= 2 && idx <= 4) {
            const without15 = digits.substring(0, idx) + digits.substring(idx + 2);
            if (without15.length === 10) {
                return '549' + without15 + '@c.us';
            }
        }
    }

    if (digits.startsWith('1111')) digits = digits.substring(2);
    if (digits.length === 10) {
        return '549' + digits + '@c.us';
    }
    if (digits.length === 8 && !digits.startsWith('11')) {
        return '54911' + digits + '@c.us';
    }
    if (digits.length === 8 && digits.startsWith('11')) {
        return '549' + digits + '@c.us';
    }
    if (digits.length >= 11) {
        return digits + '@c.us';
    }
    return target;
};

const resolveTargetChatId = async (targetId) => {
    if (!client || currentStatus !== 'BOT ONLINE') throw new Error('Bot apagado o desconectado');
    
    // Si ya es un ID de chat nativo (@lid o @g.us), verificar directamente en WhatsApp Web
    if (targetId.endsWith('@lid') || targetId.endsWith('@g.us')) {
        try {
            const chatExists = await client.pupPage.evaluate(async (id) => {
                try {
                    if (window.WWebJS && window.WWebJS.getChat) {
                        const c = await window.WWebJS.getChat(id, { getAsModel: false });
                        if (c) return true;
                    }
                    const wid = window.require('WAWebWidFactory').createWid(id);
                    return Boolean(window.require('WAWebCollections').Chat.get(wid));
                } catch (e) {
                    return false;
                }
            }, targetId);
            if (chatExists) return targetId;
        } catch (e) {}
    }

    const rawNumber = targetId.includes('@') ? targetId.split('@')[0] : targetId;

    const queryExists = async (num) => {
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
            const queryPromise = client.getNumberId(num);
            return await Promise.race([queryPromise, timeoutPromise]);
        } catch (e) {
            return null;
        }
    };

    // 1. Probar con getNumberId directo
    let numberId = await queryExists(rawNumber);
    if (numberId && numberId._serialized) {
        return numberId._serialized;
    }

    // 2. Probar variantes para números de Argentina (con o sin 9)
    if (rawNumber.startsWith('549')) {
        const without9 = '54' + rawNumber.substring(3);
        numberId = await queryExists(without9);
        if (numberId && numberId._serialized) {
            return numberId._serialized;
        }
    } else if (rawNumber.startsWith('54') && !rawNumber.startsWith('549')) {
        const with9 = '549' + rawNumber.substring(2);
        numberId = await queryExists(with9);
        if (numberId && numberId._serialized) {
            return numberId._serialized;
        }
    }

    // 3. Probar si el chat ya existe en el DOM/Store local de WhatsApp Web
    try {
        const chatExists = await client.pupPage.evaluate((id) => {
            try {
                const wid = window.require('WAWebWidFactory').createWid(id);
                return Boolean(window.require('WAWebCollections').Chat.get(wid));
            } catch (e) {
                return false;
            }
        }, targetId);
        if (chatExists) {
            return targetId;
        }
    } catch (e) {}

    // No existe en WhatsApp
    throw new Error(`El número ${rawNumber} no está registrado en WhatsApp o es inválido.`);
};

const sendMessage = async (to, content, media = null) => {
    if (!client || currentStatus !== 'BOT ONLINE') throw new Error('Bot apagado o desconectado');
    let targetId = normalizePhoneRecipient(to);
    
    // Resolver y validar que el contacto esté registrado en WhatsApp antes de enviar
    const validChatId = await resolveTargetChatId(targetId);

    const executeSend = async (id) => {
        const sendPromise = media
            ? client.sendMessage(id, MessageMedia.fromFilePath(media), { caption: content })
            : client.sendMessage(id, content);
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout de 35s esperando confirmación de envío en WhatsApp Web')), 35000);
        });

        return await Promise.race([sendPromise, timeoutPromise]);
    };

    try {
        return await executeSend(validChatId);
    } catch (err) {
        let errMsg = err.message || '';
        
        // Si falló por frame desprendido o contexto destruido en Puppeteer, intentar una re-ejecución tras 1.5s
        if (errMsg.includes('detached Frame') || errMsg.includes('Execution context was destroyed')) {
            console.warn(`[WHATSAPP] Advertencia de frame al enviar a ${validChatId} (${errMsg}). Reintentando en 1500ms...`);
            await new Promise(r => setTimeout(r, 1500));
            if (client && currentStatus === 'BOT ONLINE') {
                return await executeSend(validChatId);
            }
        }

        // Intento secundario con getChatById si aún fallara
        if (
            errMsg.includes('No LID') ||
            errMsg.includes('Data passed to getter') ||
            errMsg.includes('memoize') ||
            errMsg.includes('undefined') ||
            errMsg.includes('detached Frame')
        ) {
            try {
                const chat = await client.getChatById(validChatId);
                if (chat) {
                    if (media) {
                        return await chat.sendMessage(MessageMedia.fromFilePath(media), { caption: content });
                    }
                    return await chat.sendMessage(content);
                }
            } catch (chatErr) {}
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
    console.log("[LABELS SYNC] Iniciando sincronización profunda de etiquetas...");
    try {
        const labels = await client.getLabels();
        for (const label of labels) {
            try {
                let chats = [];
                const isFavorite = (String(label.id) === '2' || (label.name && label.name.toLowerCase().includes('favorit')));

                if (isFavorite) {
                    const favChats = await getFavoriteChatsFromWhatsApp();
                    if (favChats && favChats.length > 0) {
                        chats = favChats.map(f => ({
                            id: { _serialized: f.id, user: f.number },
                            name: f.name
                        }));
                    }
                } else {
                    // Intentar obtener chats por método estándar de whatsapp-web.js
                    try {
                        chats = await label.getChats();
                    } catch (ce) {
                        console.warn(`[LABELS SYNC] label.getChats() falló para "${label.name}":`, ce.message);
                    }
                }
                console.log(`[LABELS SYNC] Leídos ${chats ? chats.length : 0} chats para etiqueta "${label.name}".`);
                
                // 2. Solo limpiamos y re-insertamos si la API devolvió al menos 1 miembro.
                // Esto previene que una falla temporal de carga en el navegador borre la caché de la DB.
                if (chats && chats.length > 0) {
                    db.prepare('DELETE FROM label_members WHERE label_id = ?').run(label.id);
                    
                    for (const chat of chats) {
                        const chatId = chat.id ? (chat.id._serialized || chat.id) : null;
                        const chatNumber = chat.id && chat.id.user ? chat.id.user : (chatId ? chatId.split('@')[0] : '');
                        if (chatId) {
                            db.prepare('INSERT OR IGNORE INTO contacts (id, name, number) VALUES (?, ?, ?)').run(chatId, chat.name || '', chatNumber);
                            db.prepare('INSERT OR IGNORE INTO label_members (label_id, contact_id) VALUES (?, ?)').run(label.id, chatId);
                        }
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

const getActivePage = async () => {
    if (client && client.pupBrowser) {
        try {
            const pages = await client.pupBrowser.pages();
            for (const p of pages) {
                if (!p.isClosed() && p.url().includes('whatsapp.com')) {
                    client.pupPage = p;
                    return p;
                }
            }
            if (pages.length > 0) {
                client.pupPage = pages[pages.length - 1];
                return client.pupPage;
            }
        } catch (e) {
            console.error('[GET ACTIVE PAGE ERROR]', e.message);
        }
    }
    return client ? client.pupPage : null;
};

const diagnoseLabels = async () => {
    if (!client || currentStatus !== 'BOT ONLINE') {
        return { error: 'Client not online' };
    }
    try {
        const targets = client.pupBrowser ? client.pupBrowser.targets().map(t => ({
            type: t.type(),
            url: t.url()
        })) : [];

        // Try direct CDP evaluation via target._session()
        let cdpResult = null;
        let cdpError = null;
        let sessionInfo = null;
        let browserInfo = null;
        try {
            if (client.pupBrowser) {
                browserInfo = {
                    isConnected: client.pupBrowser.isConnected(),
                    wsEndpoint: client.pupBrowser.wsEndpoint(),
                    browserTargetsCount: client.pupBrowser.targets().length
                };
                const pageTarget = client.pupBrowser.targets().find(t => t.type() === 'page' && t.url().includes('whatsapp.com'));
                if (pageTarget) {
                    const session = typeof pageTarget._session === 'function' ? pageTarget._session() : null;
                    sessionInfo = {
                        hasTarget: true,
                        targetUrl: pageTarget.url(),
                        hasSession: !!session,
                        sessionType: session ? typeof session : null,
                        sessionClosed: session ? session._closed : null
                    };

                    if (session) {
                        const evalRes = await session.send('Runtime.evaluate', {
                            expression: `(() => {
                                const collections = window.require('WAWebCollections') || {};
                                const chatModels = collections.Chat ? collections.Chat.getModelsArray() : [];
                                const labelModels = collections.Label ? collections.Label.getModelsArray() : [];

                                const collectionKeys = Object.keys(collections);
                                const favCollections = collectionKeys.filter(k => /fav|filter|list|custom/i.test(k));

                                let label2Info = null;
                                if (collections.Label) {
                                    const l2 = collections.Label.get('2');
                                    if (l2) {
                                        label2Info = {
                                            id: l2.id,
                                            name: l2.name,
                                            keys: Object.keys(l2),
                                            itemCount: l2.labelItemCollection ? (l2.labelItemCollection.getModelsArray ? l2.labelItemCollection.getModelsArray().length : l2.labelItemCollection.length) : null,
                                            items: l2.labelItemCollection && l2.labelItemCollection.getModelsArray ? l2.labelItemCollection.getModelsArray().map(it => ({ id: it.id, parentId: it.parentId, parentType: it.parentType })) : []
                                        };
                                    }
                                }

                                const favCollectionsData = {};
                                for (const fk of favCollections) {
                                    try {
                                        const col = collections[fk];
                                        if (col && typeof col.getModelsArray === 'function') {
                                            const models = col.getModelsArray();
                                            favCollectionsData[fk] = {
                                                count: models.length,
                                                sample: models.slice(0, 5).map(m => {
                                                    const out = {};
                                                    for (const k of Object.keys(m).slice(0, 15)) {
                                                        const v = m[k];
                                                        out[k] = (typeof v === 'object' && v !== null) ? (v._serialized || (Array.isArray(v) ? v.length : 'object')) : v;
                                                    }
                                                    return out;
                                                })
                                            };
                                        }
                                    } catch (e) {
                                        favCollectionsData[fk] = { error: e.message };
                                    }
                                }

                                const sampleChat = chatModels[0] || {};
                                const allChatKeys = Object.keys(sampleChat);
                                const interestingKeys = allChatKeys.filter(k => /fav|star|pin|label|list|filter|rank|priority/i.test(k));

                                const candidates = [];
                                for (const c of chatModels) {
                                    const id = c.id ? (c.id._serialized || String(c.id)) : 'unknown';
                                    const name = String(c.name || c.formattedTitle || '');
                                    const labels = Array.isArray(c.labels) ? c.labels : [];
                                    
                                    const props = {};
                                    let isFavSignal = false;
                                    for (const k of interestingKeys) {
                                        const val = c[k];
                                        if (val !== undefined && val !== null && val !== false && val !== 0 && !(Array.isArray(val) && val.length === 0)) {
                                            props[k] = (typeof val === 'object' && val !== null) ? (val._serialized || (Array.isArray(val) ? val.length : 'object')) : val;
                                            if (/fav/i.test(k) && Boolean(val)) isFavSignal = true;
                                        }
                                    }

                                    if (labels.includes('2') || labels.includes(2) || isFavSignal || c.pinned) {
                                        candidates.push({ id, name, labels, props, pinned: c.pinned });
                                    }
                                }

                                return {
                                    totalChats: chatModels.length,
                                    labels: labelModels.map(l => ({ id: String(l.id), name: String(l.name) })),
                                    collectionKeys,
                                    favCollections,
                                    favCollectionsData,
                                    label2Info,
                                    interestingKeys,
                                    candidatesCount: candidates.length,
                                    candidates
                                };
                            })()`,
                            returnByValue: true,
                            awaitPromise: true
                        });
                        cdpResult = evalRes.result ? evalRes.result.value : evalRes;
                    } else {
                        cdpError = 'pageTarget._session() returned null';
                    }
                } else {
                    cdpError = 'No page target found for whatsapp.com';
                }
            } else {
                cdpError = 'pupBrowser is null';
            }
        } catch (ce) {
            cdpError = ce.message;
        }

        return {
            browserInfo,
            targets,
            sessionInfo,
            cdpError,
            cdpResult
        };
    } catch (e) {
        return { error: e.message, stack: e.stack };
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

const requestPairingCode = async (phoneNumber, forceNew = false) => {
    const cleanNumber = sanitizePairingNumber(phoneNumber);
    if (!cleanNumber || cleanNumber.length < 8) {
        throw new Error('Número de teléfono inválido. Ingrese código de país y número (ej: 11 2345 6789 o 5491123456789).');
    }

    if (currentStatus === 'BOT ONLINE') {
        return { success: true, alreadyOnline: true, message: '¡El bot ya se encuentra en línea y conectado!' };
    }

    const now = Date.now();
    const CODE_LIFETIME_MS = 140000; // 2 minutos y 20 segundos

    // 1. Si ya existe un código vigente para este número y no se fuerza regeneración, retornarlo sin destruir Chromium
    if (!forceNew && lastPairingCode && currentPairingPhone === cleanNumber && (now - lastPairingCodeTime < CODE_LIFETIME_MS) && currentStatus === 'CÓDIGO GENERADO' && client) {
        console.log(`[PAIRING] Reutilizando código activo vigente: ${lastPairingCode} para ${cleanNumber}`);
        return { 
            success: true, 
            code: lastPairingCode, 
            phoneNumber: cleanNumber,
            expiresInSeconds: Math.round((CODE_LIFETIME_MS - (now - lastPairingCodeTime)) / 1000)
        };
    }

    // 2. Si ya hay una generación en curso para este número, unirse a esa promesa (Single-Flight Mutex)
    if (activePairingPromise) {
        console.log(`[PAIRING] Solicitud concurrente detectada para ${cleanNumber}. Aguardando proceso activo...`);
        return await activePairingPromise;
    }

    // 3. Crear proceso de generación con protección Mutex
    activePairingPromise = (async () => {
        try {
            console.log(`[PAIRING] Iniciando solicitud de código nativo para: ${cleanNumber}`);
            lastPairingCode = null;
            currentPairingPhone = cleanNumber;
            currentStatus = 'GENERANDO CÓDIGO';
            if (io) {
                io.emit('status', currentStatus);
                io.emit('pairing_code', null);
            }

            await startClient(cleanNumber, true);
            const waitInstanceId = currentInstanceId;

            const maxWaitMs = 40000;
            const startTime = Date.now();

            while (!lastPairingCode && currentStatus !== 'BOT ONLINE' && currentStatus !== 'DESCONECTADO' && !isStoppingClient && (waitInstanceId === currentInstanceId) && Date.now() - startTime < maxWaitMs) {
                await new Promise(r => setTimeout(r, 400));
            }

            if (isStoppingClient || currentStatus === 'DESCONECTADO' || waitInstanceId !== currentInstanceId) {
                console.log('[PAIRING] Solicitud de código abortada por detención manual.');
                return { success: false, aborted: true, message: 'La solicitud de código fue cancelada porque el bot se detuvo.' };
            }

            if (lastPairingCode) {
                lastPairingCodeTime = Date.now();
                console.log(`[PAIRING] Nuevo código obtenido con éxito: ${lastPairingCode}`);
                return { success: true, code: lastPairingCode, phoneNumber: cleanNumber };
            }

            if (currentStatus === 'BOT ONLINE') {
                return { success: true, alreadyOnline: true, message: '¡El bot ya se encuentra en línea y conectado!' };
            }

            // Si llegamos acá, falló la obtención del código por timeout o limitación de WhatsApp
            currentStatus = 'DESCONECTADO';
            lastPairingCode = null;
            if (io) {
                io.emit('status', currentStatus);
                io.emit('pairing_code', null);
            }
            throw new Error('WhatsApp no respondió con un código a tiempo. Si intentaste varias veces seguidas, WhatsApp bloquea temporalmente los códigos para esta línea (5 a 10 min). Podés vincularte de inmediato escaneando el código QR en la pestaña "Escanear QR".');
        } catch (err) {
            if (currentStatus !== 'BOT ONLINE' && currentStatus !== 'CÓDIGO GENERADO') {
                currentStatus = 'DESCONECTADO';
                lastPairingCode = null;
                if (io) {
                    io.emit('status', currentStatus);
                    io.emit('pairing_code', null);
                }
            }
            throw err;
        } finally {
            activePairingPromise = null;
        }
    })();

    return await activePairingPromise;
};

const cancelPairingCode = async () => {
    lastPairingCode = null;
    currentPairingPhone = null;
    lastPairingCodeTime = 0;
    activePairingPromise = null;
    currentStatus = 'DESCONECTADO';
    if (io) {
        io.emit('pairing_code', null);
        io.emit('status', currentStatus);
    }
    await terminateClient();
    return { success: true };
};

module.exports = { 
    initWhatsApp, 
    startClient, 
    stopClient, 
    restartClient,
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
    getFavoriteChatsFromWhatsApp,
    diagnoseLabels,
    requestPairingCode,
    cancelPairingCode,
    sanitizePairingNumber
};
