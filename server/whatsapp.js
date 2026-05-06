const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');

let client = null;
let io = null;

const initWhatsApp = (socketIo) => {
    io = socketIo;
    console.log('--- WHATSAPP MODULE READY (WAITING FOR START COMMAND) ---');
};

const startClient = async () => {
    if (client) {
        console.log('Client already exists, stopping first...');
        await stopClient();
    }

    console.log('--- STARTING WHATSAPP CLIENT ---');
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './sessions' }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', (qr) => {
        console.log('--- QR RECEIVED ---');
        io.emit('qr', qr);
    });

    client.on('ready', async () => {
        console.log('--- READY ---');
        io.emit('ready', true);
        try {
            const labels = await client.getLabels();
            io.emit('labels', labels);
        } catch (e) {}
    });

    client.on('disconnected', () => {
        console.log('--- DISCONNECTED ---');
        io.emit('disconnected');
        client = null;
    });

    try {
        await client.initialize();
    } catch (err) {
        console.error('Init Error:', err);
        io.emit('error', err.message);
    }
};

const stopClient = async () => {
    if (client) {
        try {
            await client.destroy();
            console.log('--- CLIENT STOPPED ---');
        } catch (e) {
            console.error('Stop Error:', e);
        }
        client = null;
        io.emit('disconnected');
    }
};

const getClient = () => client;

const getLabels = async () => {
    if (!client) return [];
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

module.exports = { initWhatsApp, startClient, stopClient, getClient, getLabels, getContactsByLabel, sendMessage };
