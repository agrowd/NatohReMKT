const fs = require('fs');
const path = require('path');

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
    const fileContent = fs.readFileSync(vcfPath, 'utf-8');
    const parsedContacts = parseVCF(fileContent);
    
    const countMap = {};
    
    for (const c of parsedContacts) {
        const name = (c.name || '').toLowerCase();
        if (name.includes('luz') || name.includes('hifu')) {
            for (const rawNum of c.numbers) {
                const normalized = normalizePhoneNumber(rawNum);
                if (normalized) {
                    if (!countMap[normalized]) {
                        countMap[normalized] = [];
                    }
                    countMap[normalized].push({ name: c.name, raw: rawNum });
                }
            }
        }
    }
    
    // Sort normalized numbers by their occurrences
    const sorted = Object.entries(countMap)
        .map(([normalized, occurrences]) => ({ normalized, occurrences, count: occurrences.length }))
        .sort((a, b) => b.count - a.count);
        
    console.log("Top 10 most duplicated normalized numbers:");
    sorted.slice(0, 10).forEach(item => {
        console.log(`Normalized: ${item.normalized} (Occurrences: ${item.count})`);
        item.occurrences.forEach(occ => {
            console.log(`  - Name: ${occ.name}, Raw: ${occ.raw}`);
        });
    });
}

run();
