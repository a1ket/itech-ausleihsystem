import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Nur POST Anfragen zulassen
  if (req.method !== 'POST') return res.status(405).json({ reply: "Anfrage-Methode nicht erlaubt." });

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } = process.env;

  // Verbindung zu Supabase mit dem Master-Key (Service Key)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { message } = req.body;

    // 1. Schritt: Alle Geräte aus der DB holen (ohne Filter, um UUID-Probleme zu vermeiden)
    const { data: allItems, error: dbError } = await supabase.from('loans').select('item_name, user_id');
    
    if (dbError) {
      return res.status(200).json({ reply: `Datenbank-Hinweis: ${dbError.message}. Hast du die Tabelle 'loans' angelegt?` });
    }

    // 2. Schritt: Verfügbarkeit berechnen (user_id ist leer)
    const available = allItems
      ?.filter(item => !item.user_id)
      .map(item => item.item_name)
      .join(", ") || "Keine Geräte verfügbar";

    // 3. Schritt: OpenAI fragen
    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Du bist die ITECH-Ausleih-KI. Der aktuelle Bestand an freien Geräten ist: ${available}. Antworte kurz und hilf dem User beim Ausleihen.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await openAIRes.json();

    // 4. Schritt: OpenAI Fehler (z.B. kein Guthaben) abfangen
    if (aiData.error) {
      return res.status(200).json({ reply: `OpenAI Info: ${aiData.error.message}` });
    }

    return res.status(200).json({ reply: aiData.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: `System-Fehler: ${err.message}` });
  }
}