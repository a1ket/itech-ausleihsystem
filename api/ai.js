import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt." });

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } = process.env;

  if (!SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
    return res.status(500).json({ reply: "Konfigurationsfehler: Keys fehlen in Vercel." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { message } = req.body;

    // 1. Bestand abrufen (Wir laden alles und filtern im Code, um Typ-Konflikte zu vermeiden)
    const { data: items, error: dbError } = await supabase.from('loans').select('item_name, user_id');
    
    if (dbError) {
      return res.status(500).json({ reply: "Datenbank-Zugriff fehlgeschlagen: " + dbError.message });
    }

    // Wer hat keine user_id? (Das sind die verfügbaren)
    const available = items
      ?.filter(i => i.user_id === null || i.user_id === "")
      .map(i => i.item_name);
    
    const stockList = available.length > 0 ? available.join(", ") : "Momentan alles verliehen";

    // 2. OpenAI API kontaktieren
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system", 
            content: `Du bist der ITECH-Ausleih-Assistent. 
            Verfügbare Geräte: ${stockList}. 
            Antworte kurz, freundlich und sag dem User, was er ausleihen kann.` 
          },
          { role: "user", content: message }
        ],
        temperature: 0.7
      })
    });

    const aiData = await aiRes.json();
    
    if (aiData.error) {
      return res.status(500).json({ reply: "OpenAI Fehler: " + aiData.error.message });
    }

    return res.status(200).json({ reply: aiData.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ reply: "Server-Absturz: " + err.message });
  }
}