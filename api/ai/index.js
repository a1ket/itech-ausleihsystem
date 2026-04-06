// Pfad: /api/ai/index.js
import { createClient } from '@supabase/supabase-js';

// Nutze den SERVICE_ROLE_KEY aus deinem Supabase Dashboard (Settings -> API)
// Dieser Key darf NIEMALS in der index.html stehen!
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { message, userId } = req.body;

  try {
    const msgLower = message.toLowerCase();
    let actionPerformed = false;
    let reply = "";

    // --- LOGIK: ERKENNEN WAS AUSGELIEHEN WIRD ---
    // Wenn die Nachricht Wörter wie "leihe", "brauche" oder "nehme" enthält:
    if (msgLower.includes("leihe") || msgLower.includes("nehme") || msgLower.includes("brauche")) {
      
      // Wir suchen das Gerät (einfache Logik: das letzte Wort im Satz)
      const wörter = message.replace(/[?!.]/g, "").split(" ");
      const geraet = wörter[wörter.length - 1]; 

      // --- SUPABASE SCHREIBBEFEHL ---
      const { error } = await supabase
        .from('loans')
        .insert([
          { 
            user_id: userId, 
            item_name: geraet, // Hier wird das Wort (z.B. iPad) reingeschrieben
            loan_date: new Date().toISOString() 
          }
        ]);

      if (!error) {
        actionPerformed = true;
        reply = `Alles klar! Ich habe das ${geraet} für dich in die Liste eingetragen.`;
      } else {
        reply = "Datenbank-Fehler: " + error.message;
      }

    } else {
      // Normale KI-Antwort, wenn nichts ausgeliehen wird
      reply = "Ich bin dein ITECH-Assistent. Wie kann ich helfen?";
    }

    // Antwort an dein Frontend (index.html) schicken
    return res.status(200).json({ 
      reply: reply, 
      actionPerformed: actionPerformed 
    });

  } catch (err) {
    return res.status(500).json({ reply: "Server-Fehler: " + err.message });
  }
}