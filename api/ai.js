import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } = process.env;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { message } = req.body;

    // TEST: Erst mal nur schauen, ob wir IRGENDWAS aus der DB bekommen
    const { data: items, error: dbError } = await supabase.from('loans').select('item_name, user_id');
    
    if (dbError) {
      console.error("DB Error:", dbError);
      return res.status(500).json({ reply: "Datenbank-Fehler: " + dbError.message });
    }

    // Verfügbarkeit berechnen
    const stock = items?.filter(i => !i.user_id).map(i => i.item_name).join(", ") || "Keine";

    // OpenAI Call
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Du bist ein Helfer. Bestand: ${stock}` },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiRes.json();
    
    if (aiData.error) {
      return res.status(500).json({ reply: "OpenAI Fehler: " + aiData.error.message });
    }

    return res.status(200).json({ reply: aiData.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ reply: "Globaler Fehler im Server." });
  }
}