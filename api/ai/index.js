// /api/ai/index.js
import { createClient } from '@supabase/supabase-js';

// Diese Schlüssel musst du in Vercel als Environment Variables speichern!
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Wir holen die Daten vom Frontend (index.html)
  const { message, userId } = req.body;

  // Der Befehl für die KI
  const systemPrompt = "Du bist der ITECH Ausleih-Assistent. Antworte in nur 1 kurzen Satz. Wenn der User etwas ausleihen will, sag nur: OK, ich trage [Gerät] ein.";

  try {
    // A: Logik zum Speichern in der Datenbank
    const msgLower = message.toLowerCase();
    
    // Wenn Wörter wie "ausleihen" oder "nehme" vorkommen
    if (msgLower.includes("leihe") || msgLower.includes("nehme") || msgLower.includes("brauche")) {
      
      // Wir suchen das Gerät im Text (einfaches Beispiel: das letzte Wort)
      const words = message.split(" ");
      const item = words[words.length - 1].replace(".", "");

      // HIER schreiben wir in DEINE Tabelle
      const { error } = await supabase
        .from('loans')
        .insert([{ 
          user_id: userId, 
          item_name: item,
          loan_date: new Date().toISOString() 
        }]);

      if (!error) {
        return res.status(200).json({ 
          reply: `OK, ${item} ist eingetragen.`, 
          actionPerformed: true 
        });
      }
    }

    // B: Wenn es nur eine normale Frage ist, schick es zur KI (z.B. OpenAI)
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 40
      })
    });

    const data = await aiRes.json();
    return res.status(200).json({ 
      reply: data.choices[0].message.content, 
      actionPerformed: false 
    });

  } catch (error) {
    return res.status(500).json({ reply: "Fehler im System." });
  }
}