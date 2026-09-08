const db = require('./database');

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

function seed() {
    const flowName = 'EnvioAntigravity';
    const existingFlow = db.prepare('SELECT id FROM flows WHERE name = ?').get(flowName);
    
    if (!existingFlow) {
        const info = db.prepare('INSERT INTO flows (name, steps) VALUES (?, ?)').run(flowName, JSON.stringify(antigravitySteps));
        console.log(`[SEED] Flujo "${flowName}" creado exitosamente con ID ${info.lastInsertRowid}.`);
    } else {
        db.prepare('UPDATE flows SET steps = ? WHERE id = ?').run(JSON.stringify(antigravitySteps), existingFlow.id);
        console.log(`[SEED] Flujo "${flowName}" (ID ${existingFlow.id}) actualizado correctamente con los 2 bloques y variantes.`);
    }

    const flow = db.prepare('SELECT id, name, steps, created_at FROM flows WHERE name = ?').get(flowName);
    console.log('--- DETALLE DEL FLUJO CARGADO ---');
    console.log(`Nombre: ${flow.name}`);
    console.log(`Bloques cargados: ${JSON.parse(flow.steps).length}`);
    console.log('Listo para seleccionar en el panel de Flujos Guardados.');
}

seed();
