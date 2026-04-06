import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Nur POST erlauben
  if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt." });

  // Umgebungsvariablen von Vercel laden
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } = process.env;

  // 1. Initialer Check der Keys
  if (!SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
    return res.status(200).json({ reply: "Fehler: API-Keys fehlen in den Vercel Settings!" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { message } = req.body;

    // 2. Datenbank abfragen (Check ob die Tabelle existiert und lesbar ist)
    const { data: items, error: dbError } = await supabase.from('loans').select('item_name, user_id');
    
    if (dbError) {
      return res.status(200).json({ reply: `Datenbank-Fehler: ${dbError.message}. Prüfe Tabellennamen und RLS!` });
    }

    // Verfügbare Geräte filtern (wo user_id leer ist)
    const available = items?.filter(i => !i.user_id).map(i => i.item_name).join(", ") || "Keine";

    // 3. OpenAI API Anfrage
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Du bist der ITECH-Assistent. Aktueller Bestand: ${available}` },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiRes.json();
    
    // Fehler von OpenAI abfangen (z.B. kein Guthaben)
    if (aiData.error) {
      return res.status(200).json({ reply: `OpenAI Fehler: ${aiData.error.message}` });
    }

    return res.status(200).json({ reply: aiData.choices[0].message.content });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ reply: `Server-Fehler: ${err.message}` });
  }
}