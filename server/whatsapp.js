const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

let client = null;
let io = null;
let currentStatus = 'DESCONECTADO';
let lastQr = null;

const initWhatsApp = (socketIo) => {
    io = socketIo;
    console.log('--- WHATSAPP MODULE READY ---');
};

const getStatus = () => ({
    status: currentStatus,
    qr: lastQr
});

const startClient = async () => {
    if (client) return; // Ya esta intentando o conectado

    currentStatus = 'INICIANDO';
    lastQr = null;
    io.emit('status', currentStatus);

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
        io.emit('qr', qr);
        io.emit('status', currentStatus);
    });

    client.on('ready', async () => {
        currentStatus = 'BOT ONLINE';
        lastQr = null;
        console.log('--- CLIENT READY ---');
        io.emit('ready', true);
        io.emit('status', currentStatus);
        
        // Carga inicial de etiquetas
        try {
            const labels = await client.getLabels();
            io.emit('labels', labels);
        } catch (e) {}
    });

    client.on('disconnected', () => {
        currentStatus = 'DESCONECTADO';
        lastQr = null;
        console.log('--- DISCONNECTED ---');
        io.emit('status', currentStatus);
        client = null;
    });

    try {
        await client.initialize();
    } catch (err) {
        console.error('Init Error:', err);
        currentStatus = 'DESCONECTADO';
        io.emit('status', currentStatus);
        client = null;
    }
};

const stopClient = async () => {
    if (client) {
        try { await client.destroy(); } catch (e) {}
        client = null;
        currentStatus = 'DESCONECTADO';
        lastQr = null;
        io.emit('status', currentStatus);
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
    if (!client) return [];
    try {
        const label = await client.getLabelById(labelId);
        return await label.getChats();
    } catch (e) { return []; }
};

const sendMessage = async (to, content, media = null) => {
    if (!client) throw new Error('Bot apagado');
    if (media) {
        return await client.sendMessage(to, MessageMedia.fromFilePath(media), { caption: content });
    }
    return await client.sendMessage(to, content);
};

module.exports = { initWhatsApp, startClient, stopClient, logout, getLabels, getContactsByLabel, sendMessage, getStatus };
