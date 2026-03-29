import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Supabase Server-Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, userId } = req.body;

    // 1️⃣ Alle Loans abrufen
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*');

    if (error) throw error;

    // 2️⃣ Verfügbare Items zählen
    const availableCounts = {};
    loans.forEach(l => {
      if (!l.user_id) {
        availableCounts[l.item_name] = (availableCounts[l.item_name] || 0) + 1;
      }
    });

    const availableText = Object.keys(availableCounts)
      .map(name => `${name}: ${availableCounts[name]} verfügbar`)
      .join(", ");

    // 3️⃣ OpenAI Anfrage
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Du bist ein freundliches Ausleihsystem für IT-Geräte.
Nutze diese Informationen über verfügbare Geräte, um die Fragen des Nutzers zu beantworten:
${availableText}
Antworten sollen präzise, freundlich und in eigenen Worten sein.`
          },
          { role: "user", content: message }
        ],
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Fehler:", errText);
      return res.status(500).json({ reply: "Fehler bei der KI-Anfrage." });
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    res.status(200).json({ reply });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ reply: "Fehler bei der KI-Anfrage." });
  }
}