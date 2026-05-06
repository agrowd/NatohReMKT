const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

let client = null;
let io = null;

const initWhatsApp = (socketIo) => {
    io = socketIo;
    console.log('--- WHATSAPP MODULE READY ---');
};

const startClient = async () => {
    if (client) await stopClient();

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
        console.log('--- CLIENT READY (SYNCING) ---');
        io.emit('ready', true);
        
        // Intentar cargar etiquetas con re-intentos (WhatsApp tarda en sincronizar)
        let attempts = 0;
        const fetchInterval = setInterval(async () => {
            attempts++;
            try {
                const labels = await client.getLabels();
                console.log(`Attempt ${attempts}: Found ${labels.length} labels`);
                if (labels.length > 0 || attempts > 5) {
                    io.emit('labels', labels);
                    clearInterval(fetchInterval);
                }
            } catch (e) {
                console.log(`Attempt ${attempts} failed: ${e.message}`);
            }
        }, 5000);
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
        try { await client.destroy(); } catch (e) {}
        client = null;
        io.emit('disconnected');
    }
};

const getLabels = async () => {
    if (!client) return [];
    try {
        const labels = await client.getLabels();
        return labels;
    } catch (e) {
        console.error("Error manual getLabels:", e.message);
        return [];
    }
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

module.exports = { initWhatsApp, startClient, stopClient, getLabels, getContactsByLabel, sendMessage };
