const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

let client;
let io;

const initWhatsApp = (socketIo) => {
    io = socketIo;
    console.log('--- INITIALIZING WHATSAPP CLIENT ---');

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './sessions'
        }),
        puppeteer: {
            headless: true, // Use 'true' for older versions or 'new' for latest
            executablePath: process.env.CHROME_PATH || null, // Allow custom chrome path
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
        }
    });

    client.on('qr', (qr) => {
        console.log('--- QR RECEIVED ---');
        io.emit('qr', qr);
    });

    client.on('loading_screen', (percent, message) => {
        console.log('LOADING:', percent, message);
        io.emit('loading', { percent, message });
    });

    client.on('authenticated', () => {
        console.log('--- AUTHENTICATED ---');
        io.emit('authenticated', true);
    });

    client.on('auth_failure', msg => {
        console.error('--- AUTH FAILURE ---', msg);
        io.emit('auth_failure', msg);
    });

    client.on('ready', async () => {
        console.log('--- CLIENT IS READY ---');
        io.emit('ready', { status: true });
        
        try {
            const labels = await client.getLabels();
            console.log('Labels loaded:', labels.length);
            io.emit('labels', labels);
        } catch (err) {
            console.error('Error fetching labels on ready:', err.message);
        }
    });

    client.on('disconnected', (reason) => {
        console.log('--- DISCONNECTED ---', reason);
        io.emit('disconnected', reason);
    });

    client.initialize().catch(err => {
        console.error('--- INITIALIZATION ERROR ---', err);
    });
};

const getClient = () => client;

const getLabels = async () => {
    try {
        if (!client) return [];
        // Important: getLabels might fail if not ready
        return await client.getLabels();
    } catch (err) {
        console.error('getLabels Error:', err.message);
        return [];
    }
};

const getContactsByLabel = async (labelId) => {
    if (!client) return [];
    try {
        const label = await client.getLabelById(labelId);
        return await label.getChats();
    } catch (err) {
        console.error('getContactsByLabel Error:', err.message);
        return [];
    }
};

const sendMessage = async (to, content, media = null) => {
    if (!client) throw new Error('Client not initialized');
    
    if (media) {
        // media should be a MessageMedia instance or base64 data
        const messageMedia = typeof media === 'string' ? MessageMedia.fromFilePath(media) : media;
        return await client.sendMessage(to, messageMedia, { caption: content });
    }
    
    return await client.sendMessage(to, content);
};

module.exports = {
    initWhatsApp,
    getClient,
    getLabels,
    getContactsByLabel,
    sendMessage
};
