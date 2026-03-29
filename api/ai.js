// api/ai.js
import { supabase } from '../supabase.js';

export default async function handler(req, res) {
  try {
    const { message, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ reply: "Kein User-ID übergeben" });
    }

    // 1️⃣ Alle Items aus loans abrufen
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*');

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ reply: "Fehler beim Abrufen der Ausleihen" });
    }

    // 2️⃣ Items zählen, die noch keinem User zugewiesen sind
    const availableCounts = {};
    loans.forEach(l => {
      if (!l.user_id) availableCounts[l.item_name] = (availableCounts[l.item_name] || 0) + 1;
    });

    const availableText = Object.keys(availableCounts)
      .map(name => `${name}: ${availableCounts[name]} verfügbar`)
      .join(", ");

    // 3️⃣ OpenAI Request
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // Key aus Environment Variables
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Du bist ein freundliches Ausleihsystem für IT-Geräte. 
Nutze diese Informationen über verfügbare Geräte, um die Fragen des Nutzers zu beantworten:
${availableText}
Antworten sollen präzise, freundlich und in eigenen Worten sein.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 300
      })
    });

    const data = await openaiResponse.json();

    const reply = data.choices?.[0]?.message?.content || "Keine Antwort von der KI";

    res.status(200).json({ reply });

  } catch (err) {
    console.error("AI Handler Error:", err);
    res.status(500).json({ reply: "Fehler bei der KI-Anfrage" });
  }
}