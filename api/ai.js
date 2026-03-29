import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method Not Allowed' });

  try {
    const { message, userId } = req.body;

    if (!message || !userId) return res.status(400).json({ reply: "Fehler: Nachricht oder User-ID fehlt." });

    const { data: loans } = await supabase.from('loans').select('*');

    const availableCounts = {};
    loans.forEach(l => {
      if (!l.user_id) availableCounts[l.item_name] = (availableCounts[l.item_name] || 0) + 1;
    });

    const availableText = Object.keys(availableCounts).length > 0
      ? Object.keys(availableCounts).map(name => `${name}: ${availableCounts[name]} verfügbar`).join(", ")
      : "Keine Gegenstände verfügbar.";

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `Du bist ein freundliches Ausleihsystem für IT-Geräte. Nutze diese Infos: ${availableText}` },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";
    res.status(200).json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Fehler bei der KI-Anfrage." });
  }
}