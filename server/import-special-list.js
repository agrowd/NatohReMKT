const fs = require('fs');
const path = require('path');
const db = require('./database');

function decodeQuotedPrintable(str) {
    if (!str) return "";
    let cleaned = str.replace(/=\r?\n/g, "");
    try {
        return cleaned.replace(/(?:=[0-9A-F]{2})+/gi, (match) => {
            const bytes = match.split('=').slice(1).map(hex => parseInt(hex, 16));
            return Buffer.from(bytes).toString('utf-8');
        });
    } catch (e) {
        return cleaned;
    }
}

function normalizePhoneNumber(num) {
    if (!num) return null;
    let cleaned = num.replace(/\D/g, '');
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }
    
    if (cleaned.startsWith('54')) {
        if (cleaned.startsWith('54915')) {
            cleaned = '549' + cleaned.substring(5);
        } else if (cleaned.startsWith('5415')) {
            cleaned = '549' + cleaned.substring(4);
        } else if (!cleaned.startsWith('549')) {
            if (cleaned.length === 12) {
                cleaned = '549' + cleaned.substring(2);
            }
        }
    } else {
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        
        if (cleaned.startsWith('15') && cleaned.length === 9) {
            cleaned = cleaned.substring(2);
        } else if (cleaned.length === 10) {
            cleaned = '549' + cleaned;
        } else if (cleaned.includes('15')) {
            const idx = cleaned.indexOf('15');
            if (idx > 0 && idx < 5 && cleaned.length >= 11) {
                cleaned = cleaned.substring(0, idx) + cleaned.substring(idx + 2);
            }
        }
        
        if (cleaned.length === 10) {
            cleaned = '549' + cleaned;
        } else if (cleaned.length === 11 && cleaned.startsWith('9')) {
            cleaned = '54' + cleaned;
        }
    }
    
    if (cleaned && (cleaned.startsWith('549') || cleaned.length >= 10)) {
        return cleaned + '@c.us';
    }
    return null;
}

function parseVCF(vcfContent) {
    const contacts = [];
    const unfolded = vcfContent.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    
    let currentContact = null;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.toUpperCase() === 'BEGIN:VCARD') {
            currentContact = { name: '', numbers: [] };
            continue;
        }
        
        if (line.toUpperCase() === 'END:VCARD') {
            if (currentContact && currentContact.numbers.length > 0) {
                contacts.push(currentContact);
            }
            currentContact = null;
            continue;
        }
        
        if (!currentContact) continue;
        
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        
        const keyPart = line.substring(0, colonIdx);
        const valuePart = line.substring(colonIdx + 1);
        
        const keyParts = keyPart.split(';');
        const propName = keyParts[0].toUpperCase();
        
        if (propName === 'FN' || (propName === 'N' && !currentContact.name)) {
            let name = valuePart;
            const isQP = keyParts.some(p => p.toUpperCase() === 'ENCODING=QUOTED-PRINTABLE');
            if (isQP) {
                name = decodeQuotedPrintable(name);
            }
            
            if (propName === 'N') {
                const parts = name.split(';').map(p => p.trim()).filter(Boolean);
                if (parts.length > 1) {
                    name = parts.slice(1).join(' ') + ' ' + parts[0];
                } else {
                    name = parts.join(' ');
                }
                name = name.trim();
            }
            
            if (propName === 'FN' || !currentContact.name) {
                currentContact.name = name;
            }
        } else if (propName === 'TEL') {
            currentContact.numbers.push(valuePart.trim());
        }
    }
    
    return contacts;
}

function run() {
    const vcfPath = path.join(__dirname, '..', 'contacts2.vcf');
    if (!fs.existsSync(vcfPath)) {
        console.error(`Error: No se encontró el archivo contacts2.vcf en ${vcfPath}`);
        process.exit(1);
    }
    
    console.log(`Leyendo archivo: ${vcfPath}...`);
    const fileContent = fs.readFileSync(vcfPath, 'utf-8');
    const parsedContacts = parseVCF(fileContent);
    console.log(`Se leyeron ${parsedContacts.length} contactos del archivo VCF.`);
    
    const listName = "Luz o Hifu";
    let listId;
    const existingList = db.prepare('SELECT id FROM virtual_lists WHERE name = ?').get(listName);
    if (existingList) {
        listId = existingList.id;
        console.log(`Usando lista virtual existente "${listName}" (ID: ${listId})`);
    } else {
        const info = db.prepare('INSERT INTO virtual_lists (name, color) VALUES (?, ?)').run(listName, '#8b5cf6');
        listId = info.lastInsertRowid;
        console.log(`Creada nueva lista virtual "${listName}" (ID: ${listId})`);
    }
    
    const sentLogs = db.prepare("SELECT DISTINCT contact_id FROM logs WHERE status = 'sent'").all();
    const sentContactIds = new Set(sentLogs.map(l => l.contact_id));
    console.log(`Se encontraron ${sentContactIds.size} contactos ya contactados anteriormente (excluidos).`);
    
    const insertContact = db.prepare(`
        INSERT OR REPLACE INTO contacts (id, name, number, pushname) 
        VALUES (?, ?, ?, ?)
    `);
    
    const insertMember = db.prepare(`
        INSERT OR IGNORE INTO virtual_list_members (list_id, contact_id) 
        VALUES (?, ?)
    `);
    
    let totalMatched = 0;
    let totalImported = 0;
    let totalExcluded = 0;
    
    const transaction = db.transaction(() => {
        for (const c of parsedContacts) {
            const name = (c.name || '').toLowerCase();
            if (name.includes('luz') || name.includes('hifu')) {
                totalMatched++;
                for (const rawNum of c.numbers) {
                    const normalized = normalizePhoneNumber(rawNum);
                    if (!normalized) continue;
                    
                    if (sentContactIds.has(normalized)) {
                        totalExcluded++;
                        continue;
                    }
                    
                    const cleanNum = normalized.split('@')[0];
                    insertContact.run(normalized, c.name, cleanNum, '');
                    insertMember.run(listId, normalized);
                    totalImported++;
                }
            }
        }
    });
    
    transaction();
    
    console.log(`\n--- RESUMEN DE IMPORTACIÓN ---`);
    console.log(`• Contactos con "luz" o "hifu" en el nombre: ${totalMatched}`);
    console.log(`• Contactos importados y asociados a la lista "${listName}": ${totalImported}`);
    console.log(`• Contactos omitidos (ya se les había enviado): ${totalExcluded}`);
    console.log(`\nImportación completada con éxito.`);
}

run();
