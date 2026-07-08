const db = require('./database');

function run() {
    const lastCampaign = db.prepare(`
        SELECT c.*, f.name as flow_name 
        FROM campaigns c
        LEFT JOIN flows f ON c.flow_id = f.id
        ORDER BY c.id DESC LIMIT 1
    `).get();
    
    if (!lastCampaign) {
        console.log("No se encontraron campañas en la base de datos.");
        return;
    }
    
    console.log(`--- ÚLTIMA CAMPAÑA ENCONTRADA ---`);
    console.log(`ID: ${lastCampaign.id}`);
    console.log(`Flujo: ${lastCampaign.flow_name || 'Desconocido'}`);
    console.log(`Etiqueta/Lista: ${lastCampaign.label}`);
    console.log(`Total contactos en cola: ${lastCampaign.total_count}`);
    console.log(`Enviados registrados (sent_count): ${lastCampaign.sent_count}`);
    console.log(`Estado: ${lastCampaign.status}`);
    console.log(`Fecha de creación: ${lastCampaign.created_at}`);
    
    const stats = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM logs 
        WHERE campaign_id = ?
        GROUP BY status
    `).all(lastCampaign.id);
    
    console.log(`\n--- ESTADÍSTICAS DE ENVÍO DE LA CAMPAÑA ---`);
    if (stats.length === 0) {
        console.log("No se encontraron registros de logs para esta campaña.");
    } else {
        stats.forEach(s => {
            console.log(`• Estado "${s.status}": ${s.count}`);
        });
    }
    
    const sample = db.prepare(`
        SELECT l.*, c.name as contact_name
        FROM logs l
        LEFT JOIN contacts c ON l.contact_id = c.id
        WHERE l.campaign_id = ?
        LIMIT 50
    `).all(lastCampaign.id);
    
    console.log(`\n--- DETALLE DE LOS PRIMEROS 50 REGISTROS EN BITÁCORA ---`);
    if (sample.length === 0) {
        console.log("No hay detalles de registros.");
    } else {
        sample.forEach((item, index) => {
            console.log(`${index + 1}. Contacto: ${item.contact_name || 'Sin nombre'} (${item.contact_id}) | Estado: ${item.status} | Detalle: ${item.message || '-'}`);
        });
    }
}

run();
