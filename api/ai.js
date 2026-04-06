export default async function handler(req, res) {
    // CORS Header setzen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ reply: "Nur POST erlaubt" });
    }

    const { message } = req.body;
    const API_KEY = process.env.AI_API_KEY; // Deine Vercel Environment Variable

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Das aktuelle 2026er Modell
                messages: [
                    { 
                        role: "system", 
                        content: "Du bist der KI-Assistent für das ITECH-Ausleihsystem in Hamburg. Antworte kurz und hilf Schülern bei Fragen zu IT-Geräten." 
                    },
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