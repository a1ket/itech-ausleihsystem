import { createClient } from '@supabase/supabase-js';

// Nutzt die Environment Variables von Vercel
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS & Method Check
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, userId } = req.body;

    // 1. Geräte-Daten aus Supabase ziehen
    const { data: allItems, error } = await supabase.from('loans').select('*');
    if (error) throw error;

    // 2. Verfügbarkeit berechnen (user_id ist NULL = verfügbar)
    const availableItems = {};
    allItems.forEach(item => {
      if (!item.user_id) {
        availableItems[item.item_name] = (availableItems[item.item_name] || 0) + 1;
      }
    });

    const stockInfo = Object.keys(availableItems).length > 0 
      ? Object.keys(availableItems).map(name => `${name} (${availableItems[name]}x)`).join(", ")
      : "Keine Geräte verfügbar.";

    // 3. OpenAI API Call (Vercel hat fetch eingebaut)
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Du bist die ITECH-Ausleih-KI. Sei freundlich und präzise. 
            Aktueller Bestand an freien Geräten: ${stockInfo}. 
            Wenn ein Nutzer nach Geräten fragt, nenne ihm diese Liste.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const reply = aiData.choices[0].message.content;

    return res.status(200).json({ reply });

  } catch (err) {
    console.error("Fehler im Backend:", err);
    return res.status(500).json({ reply: "Ich habe gerade technische Probleme. Versuche es später noch einmal!" });
  }
}