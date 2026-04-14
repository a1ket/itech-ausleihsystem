import { createClient } from '@supabase/supabase-js';

// WICHTIG: Name muss exakt wie in deinen Variablen sein!
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY // Angepasst von ROLE_KEY auf KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt" });

    const { message, history, userId } = req.body;

    if (!message || !userId) {
        return res.status(200).json({ reply: "System: UserID oder Nachricht fehlt." });
    }

    try {
        const msgUpper = message.toUpperCase().trim();

        // --- ZUSCHREIBE LOGIK ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            // Wir suchen einen freien Laptop
            const { data: freeItem, error: findError } = await supabase
                .from('loans')
                .select('id, item_name')
                .is('user_id', null)
                .limit(1)
                .maybeSingle();

            if (findError || !freeItem) {
                return res.status(200).json({ reply: "Leider sind momentan alle Geräte vergeben.", actionPerformed: false });
            }

            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + 42); 

            const { error: updateError } = await supabase
                .from('loans')
                .update({ 
                    user_id: String(userId), 
                    loan_date: new Date().toISOString(),
                    return_date: returnDate.toISOString()
                })
                .eq('id', freeItem.id);

            if (!updateError) {
                return res.status(200).json({ 
                    reply: `✅ Alles klar! Ich habe dir den ${freeItem.item_name} zugeschrieben. Du findest ihn jetzt in deiner Liste.`, 
                    actionPerformed: true 
                });
            }
        }

        // --- KI ANTWORT ---
        const API_KEY = process.env.AI_API_KEY;
        
        // Begrüßung nur wenn kein Verlauf da ist
        const isFirst = !history || history.length === 0;
        const systemPrompt = `Du bist der ITECH-Assistent. 
        ${isFirst ? "Begrüße den User freundlich." : "Keine Begrüßung."} 
        Max 2 Sätze. Frag nach Gerät (Laptop/iPad) und Dauer. 
        Wenn alles klar ist, sag: Bitte schreibe 'BESTÄTIGEN'.`;

        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...(history || []),
                    { role: "user", content: message }
                ],
                temperature: 0.3
            })
        });

        const aiData = await aiRes.json();
        const aiReply = aiData.choices?.[0]?.message?.content || "Ich konnte keine Antwort generieren.";

        return res.status(200).json({ reply: aiReply, actionPerformed: false });

    } catch (err) {
        return res.status(200).json({ reply: "Server-Fehler: " + err.message });
    }
}