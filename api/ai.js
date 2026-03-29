import express from 'express';
import fetch from 'node-fetch';
import { supabase } from '../supabase.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;

    // 1️⃣ Alle Items aus loans abrufen
    const { data: loans } = await supabase
      .from('loans')
      .select('*');

    // Items zählen, die noch keinem User zugewiesen sind
    const availableCounts = {};
    loans.forEach(l => {
      if (!l.user_id) {
        availableCounts[l.item_name] = (availableCounts[l.item_name] || 0) + 1;
      }
    });

    const availableText = Object.keys(availableCounts)
      .map(name => `${name}: ${availableCounts[name]} verfügbar`)
      .join(", ");

    // 2️⃣ OpenAI API Request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // Key aus Environment
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

    const data = await response.json();
    const reply = data.choices[0].message.content;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Fehler bei der KI-Anfrage." });
  }
});

export default router;