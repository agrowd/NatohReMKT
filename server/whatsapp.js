const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client;
let io;

const initWhatsApp = (socketIo) => {
    io = socketIo;

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './sessions'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <- this one helps in some VPS
                '--disable-gpu'
            ],
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        // qrcode.generate(qr, { small: true }); // Log in terminal too
        io.emit('qr', qr);
    });

    client.on('ready', async () => {
        console.log('CLIENT READY');
        io.emit('ready', { status: true });
        
        // Fetch labels on ready
        try {
            const labels = await client.getLabels();
            io.emit('labels', labels);
        } catch (err) {
            console.error('Error fetching labels:', err);
        }
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED');
        io.emit('authenticated', true);
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
        io.emit('auth_failure', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        io.emit('disconnected', reason);
    });

    client.initialize();
};

const getClient = () => client;

const getLabels = async () => {
    if (!client) return [];
    return await client.getLabels();
};

const getContactsByLabel = async (labelId) => {
    if (!client) return [];
    const label = await client.getLabelById(labelId);
    return await label.getChats();
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
