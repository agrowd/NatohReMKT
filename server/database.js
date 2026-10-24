const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'natoh.db'));

// Tabla de Flujos
db.prepare(`
    CREATE TABLE IF NOT EXISTS flows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        steps TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Tabla de Campañas
db.prepare(`
    CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flow_id INTEGER,
        label TEXT,
        status TEXT DEFAULT 'pending',
        sent_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id)
    )
`).run();

// Tabla de Logs
db.prepare(`
    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        contact_id TEXT,
        status TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
`).run();

// NUEVA: Tabla de Usuarios
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )
`).run();

// NUEVA: Tabla de Contactos (Cache local para evitar lazy loading)
db.prepare(`
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT,
        number TEXT,
        pushname TEXT,
        last_synced DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// NUEVA: Relación Contactos <-> Etiquetas
db.prepare(`
    CREATE TABLE IF NOT EXISTS label_members (
        label_id TEXT,
        contact_id TEXT,
        PRIMARY KEY (label_id, contact_id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
    )
`).run();

// NUEVA: Tabla de Listas Virtuales locales
db.prepare(`
    CREATE TABLE IF NOT EXISTS virtual_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// NUEVA: Miembros de las Listas Virtuales locales (Relación Muchos a Muchos)
db.prepare(`
    CREATE TABLE IF NOT EXISTS virtual_list_members (
        list_id INTEGER,
        contact_id TEXT,
        PRIMARY KEY (list_id, contact_id),
        FOREIGN KEY (list_id) REFERENCES virtual_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
    )
`).run();

// Migraciones de esquema seguras
try { db.prepare('ALTER TABLE contacts ADD COLUMN last_sent_at DATETIME').run(); } catch(e) {}
try { db.prepare('ALTER TABLE contacts ADD COLUMN sent_count INTEGER DEFAULT 0').run(); } catch(e) {}
try { db.prepare('ALTER TABLE campaigns ADD COLUMN config TEXT').run(); } catch(e) {}

// Tabla de Configuraciones Globales
db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Configuración por defecto: 2 meses (60 días)
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('exclusionPeriod', '60d')`).run();

// Índices para optimizar búsquedas masivas de exclusión anti-spam
db.prepare(`CREATE INDEX IF NOT EXISTS idx_contacts_last_sent ON contacts(last_sent_at)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_contact_sent ON logs(contact_id, status, created_at)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)`).run();

// Backfill automático de last_sent_at y sent_count desde logs históricos
try {
    const updateBackfill = db.prepare(`
        UPDATE contacts 
        SET last_sent_at = (SELECT MAX(created_at) FROM logs WHERE logs.contact_id = contacts.id AND logs.status = 'sent'),
            sent_count = (SELECT COUNT(*) FROM logs WHERE logs.contact_id = contacts.id AND logs.status = 'sent')
        WHERE EXISTS (SELECT 1 FROM logs WHERE logs.contact_id = contacts.id AND logs.status = 'sent')
        AND last_sent_at IS NULL
    `);
    const res = updateBackfill.run();
    if (res.changes > 0) {
        console.log(`[DB] Backfilled last_sent_at para ${res.changes} contactos.`);
    }
} catch (e) {
    console.error('[DB] Error backfilling last_sent_at:', e.message);
}

// Normalización automática de números con prefijo local argentino '15' guardados históricamente
try {
    const broken15Contacts = db.prepare("SELECT id, name, number, pushname FROM contacts WHERE id LIKE '15%@c.us'").all();
    if (broken15Contacts.length > 0) {
        console.log(`[DB] Normalizando ${broken15Contacts.length} contactos con formato local '15...' a formato internacional...`);
        for (const c of broken15Contacts) {
            const rawDigits = c.id.split('@')[0].replace(/\D/g, '');
            const rest = rawDigits.substring(2);
            let normalizedNumber = rest;
            if (rest.length === 8) normalizedNumber = '54911' + rest;
            else if (rest.length === 10 && rest.startsWith('11')) normalizedNumber = '549' + rest;
            else if (rest.length === 10) normalizedNumber = '549' + rest;
            else normalizedNumber = '549' + rest;
            
            const normalizedId = normalizedNumber + '@c.us';
            
            db.prepare(`
                INSERT INTO contacts (id, name, number, pushname, last_sent_at, sent_count)
                SELECT ?, name, ?, pushname, last_sent_at, sent_count FROM contacts WHERE id = ?
                ON CONFLICT(id) DO UPDATE SET 
                    last_sent_at = COALESCE(contacts.last_sent_at, excluded.last_sent_at),
                    sent_count = COALESCE(contacts.sent_count, 0) + COALESCE(excluded.sent_count, 0)
            `).run(normalizedId, normalizedNumber, c.id);

            db.prepare("UPDATE OR IGNORE virtual_list_members SET contact_id = ? WHERE contact_id = ?").run(normalizedId, c.id);
            db.prepare("UPDATE OR IGNORE label_members SET contact_id = ? WHERE contact_id = ?").run(normalizedId, c.id);
            db.prepare("UPDATE OR IGNORE logs SET contact_id = ? WHERE contact_id = ?").run(normalizedId, c.id);
            db.prepare("DELETE FROM contacts WHERE id = ?").run(c.id);
        }
        console.log(`[DB] Finalizada normalización de contactos con prefijo '15'.`);
    }
} catch (e) {
    console.error('[DB] Error normalizando contactos con prefijo 15:', e.message);
}

// Insertar usuarios iniciales si no existen
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');
insertUser.run('natoh', 'Federyco88!', 'admin');
insertUser.run('esteticalacosta', 'admin123', 'user');

// Flujo por defecto: EnvioAntigravity (HIFU Corporal, Exilis y Depilación Definitiva)
const antigravitySteps = [
    {
        id: 1,
        type: 'message',
        variants: [
            "¡Hola! 👋 Renovamos las promos del mes para que te sientas increíble ✨\nLanzamos una promo especial en *Tratamientos Reductores y Celulitis*:\n🔥 *HIFU Corporal & EXILIS Ultra* (lo último en reducción, tensado y firmeza):\n🏷️ *1 zona por $75.000*\n🏷️ *2 zonas por solo $90.000* (¡aprovechás la 2da zona con un súper descuento!)",
            "¡Buenas! ¿Cómo estás? Te escribimos para contarte las novedades de esta semana en estética corporal 🌸\nSi querés tratar adiposidad localizada, tensar la piel y combatir la celulitis, sumamos una promo bomba:\n⚡ *HIFU Corporal + EXILIS*:\n👉 1 Zona: *$75.000*\n👉 2 Zonas: *$90.000*",
            "¡Hola! ¿Cómo andás? 💖 Cambiamos las promos para que pruebes lo mejor en modelado corporal:\nLlegó la combinación ideal para reducir centímetros, reafirmar y chau celulitis:\n✨ *HIFU Corporal y EXILIS*\n• 1 zona: *$75.000*\n• 2 zonas: *$90.000* (la opción más elegida)"
        ],
        mediaPath: null
    },
    {
        id: 2,
        type: 'message',
        variants: [
            "Además, abrimos nuevos cupos para *Depilación Definitiva* láser para que te olvides de los pelitos definitivamente 🙌\n📍 Te esperamos en Corrientes 1466.\n¿Te gustaría reservar tu turno para esta semana o consultarnos por alguna zona en particular? ¡Escribinos y te guardamos lugar! 📲",
            "Y como siempre, seguimos con las fechas de *Depilación Definitiva* con tecnología de última generación, rápida e indolora 🌟\n📍 Recordá que estamos en Corrientes 1466.\n¿Querés que te pasemos los días y horarios disponibles? Respondé a este mensajito y coordinamos 💬",
            "Y si venías esperando para arrancar o continuar tus sesiones de *Depilación Definitiva*, ¡sumamos fechas con turnos exclusivos! 💆‍♀️\n📍 Consultorio en Corrientes 1466.\nContanos qué zona te gustaría tratar y te reservamos un lugar antes de que se completen ✨"
        ],
        mediaPath: null
    }
];

try {
    const existingFlow = db.prepare('SELECT id FROM flows WHERE name = ?').get('EnvioAntigravity');
    if (!existingFlow) {
        db.prepare('INSERT INTO flows (name, steps) VALUES (?, ?)').run('EnvioAntigravity', JSON.stringify(antigravitySteps));
    } else {
        db.prepare('UPDATE flows SET steps = ? WHERE id = ?').run(JSON.stringify(antigravitySteps), existingFlow.id);
    }
} catch (e) {
    console.error('Error al inicializar flujo EnvioAntigravity:', e.message);
}

module.exports = db;

