import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Supabase konfigurieren
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service Role Key für Server
export const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ reply: "Fehler: Nachricht oder User-ID fehlt." });
    }

    // 1️⃣ Alle Items aus loans abrufen
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*');

    if (error) {
      console.error(error);
      return res.status(500).json({ reply: "Fehler beim Abrufen der Ausleihen." });
    }

    // Items zählen, die noch keinem User zugewiesen sind
    const availableCounts = {};
    loans.forEach(l => {
      if (!l.user_id) {
        availableCounts[l.item_name] = (availableCounts[l.item_name] || 0) + 1;
      }
    });

    const availableText = Object.keys(availableCounts).length > 0
      ? Object.keys(availableCounts)
          .map(name => `${name}: ${availableCounts[name]} verfügbar`)
          .join(", ")
      : "Keine Gegenstände verfügbar.";

    // 2️⃣ OpenAI API Request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      return res.status(500).json({ reply: "Fehler: Keine Antwort von der KI erhalten." });
    }

    const reply = data.choices[0].message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Fehler bei der KI-Anfrage." });
  }
});

export default router;