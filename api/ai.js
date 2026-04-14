export default async function handler(req, res) {
  // CORS-Header
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Nur POST erlaubt" });
  }

  // HIER WAR DER FEHLER: Wir ziehen jetzt history und systemPrompt mit raus!
  const { message, history, systemPrompt } = req.body;
  const API_KEY = process.env.AI_API_KEY; 

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          // 1. Die Regeln (Damit sie nicht labert)
          { role: "system", content: systemPrompt || "Du bist ein KI-Assistent für das ITECH-Ausleihsystem." },
          
          // 2. Das Gedächtnis (Alle vorherigen Nachrichten)
          ...(history || []),
          
          // 3. Die aktuelle Nachricht
          { role: "user", content: message }
        ],
        temperature: 0.3 // Macht die KI weniger "kreativ" und dafür präziser
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Groq Error:", data.error);
      return res.status(500).json({ reply: "KI-Fehler: " + data.error.message });
    }

    return res.status(200).json({ reply: data.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ reply: "Server-Fehler: " + err.message });
  }
}