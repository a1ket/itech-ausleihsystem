export default async function handler(req, res) {
  // CORS-Header
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt" });

  // WICHTIG: Wir holen alle Daten aus dem Frontend-Request
  const { message, history, systemPrompt, userId } = req.body;
  const API_KEY = process.env.AI_API_KEY; 

  try {
    // Falls der User "BESTÄTIGEN" schreibt, könnten wir hier die DB-Logik einbauen
    // Aber erst mal fixen wir das Gelaber:
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          // 1. Der Maulkorb (System Prompt)
          { role: "system", content: systemPrompt },
          // 2. Das Gedächtnis (Verlauf)
          ...(history || []),
          // 3. Die aktuelle Nachricht
          { role: "user", content: message }
        ],
        temperature: 0.2 // Ganz niedrig = KI wird sachlich und kurz
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return res.status(200).json({ reply: data.choices[0].message.content });

  } catch (err) {
    console.error("Backend Error:", err);
    return res.status(500).json({ reply: "Server-Fehler: " + err.message });
  }
}