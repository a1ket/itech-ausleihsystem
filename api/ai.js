export default async function handler(req, res) {
  // Nur POST-Anfragen erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Nur POST erlaubt" });
  }

  const { message } = req.body;
  const API_KEY = process.env.GROQ_API_KEY; 

  // Kontext über die ITECH Schule
  const systemPrompt = `
    Du bist der KI-Assistent für das Ausleihsystem der ITECH (BS14) in Hamburg-Wilhelmsburg.
    Deine Aufgaben:
    - Hilf Schülern bei Fragen zu Laptops, Kameras und IT-Equipment.
    - Beantworte Fragen zur ITECH professionell und freundlich auf Deutsch.
    - Halte deine Antworten kurz und präzise.
  `;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Das schnelle Gratis-Modell von Groq
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7
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