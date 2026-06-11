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

// Insertar usuarios iniciales si no existen
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');
insertUser.run('natoh', 'Federyco88!', 'admin');
insertUser.run('esteticalacosta', 'admin123', 'user');

module.exports = db;
