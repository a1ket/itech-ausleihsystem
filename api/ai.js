export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Nur POST erlaubt" });
  }

  const { message } = req.body;
  
  // WICHTIG: Hier nutzen wir jetzt den neuen Namen AI_API_KEY
  const API_KEY = process.env.AI_API_KEY; 

  const systemPrompt = `
    Du bist der KI-Assistent für das Ausleihsystem der ITECH (BS14) in Hamburg.
    Hilf den Schülern freundlich bei Fragen zu Geräten und zur Schule.
  `;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ reply: "KI-Fehler: " + data.error.message });
    }

    return res.status(200).json({ reply: data.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ reply: "Server-Fehler: " + err.message });
  }
}