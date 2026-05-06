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

// Insertar usuarios iniciales si no existen
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');
insertUser.run('natoh', 'Federyco88!', 'admin');
insertUser.run('esteticalacosta', 'admin123', 'user');

module.exports = db;
