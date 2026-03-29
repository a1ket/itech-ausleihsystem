import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Supabase Server-Client mit Service Key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Nur POST erlaubt' });
  }

  try {
    const { message, userId } = req.body;

    if (!userId) return res.status(400).json({ reply: 'Kein User angegeben' });

    // 1️⃣ Alle Items aus loans abrufen
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*');

    if (error) throw error;

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

    // 2️⃣ Prüfen, ob der Nutzer etwas ausleihen will
    let loanMessage = '';
    const lower = message.toLowerCase();
    for (const itemName of Object.keys(availableCounts)) {
      if (lower.includes(itemName.toLowerCase()) && availableCounts[itemName] > 0) {
        // Ein Item ausleihen
        await supabase.from('loans').insert({
          user_id: userId,
          item_name: itemName
        });
        availableCounts[itemName]--; // Update lokale Verfügbarkeit
        loanMessage = `${itemName} wurde für dich ausgeliehen!`;
        break;
      }
    }

    // 3️⃣ OpenAI Request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Du bist ein freundliches Ausleihsystem für IT-Geräte. 
Nutze diese Informationen über verfügbare Geräte, um die Fragen des Nutzers zu beantworten:
${Object.keys(availableCounts).map(k => `${k}: ${availableCounts[k]} verfügbar`).join(", ")}
Antworten sollen präzise, freundlich und in eigenen Worten sein.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 300
      })
    });

    const dataAI = await response.json();
    const reply = (dataAI.choices?.[0]?.message?.content || '') + (loanMessage ? `\n\n${loanMessage}` : '');

    res.status(200).json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: 'Fehler bei der KI-Anfrage.' });
  }
}