import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt" });

    const { message, history, userId } = req.body;
    const msgUpper = message.toUpperCase().trim();

    try {
        // --- LOGIK STUFE 1: DATENBANK-AKTION BEI "BESTÄTIGEN" ---
        if (msgUpper === "BESTÄTIGEN" || msgUpper === "'BESTÄTIGEN'") {
            // Suche ein freies Gerät (z.B. Laptop)
            const { data: freeItem, error: findError } = await supabase
                .from('loans')
                .select('id, item_name')
                .is('user_id', null)
                .limit(1)
                .single();

            if (findError || !freeItem) {
                return res.status(200).json({ reply: "Momentan ist leider kein Gerät verfügbar.", actionPerformed: false });
            }

            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + (6 * 7)); // 6 Wochen

            // Gerät dem User zuschreiben
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
                    reply: `✅ Erfolgreich! Der ${freeItem.item_name} (ID: ${freeItem.id}) wurde dir bis zum ${returnDate.toLocaleDateString()} zugeschrieben.`, 
                    actionPerformed: true 
                });
            } else {
                return res.status(500).json({ reply: "Datenbankfehler beim Zuschreiben." });
            }
        }

        // --- LOGIK STUFE 2: KI ANTWORT ---
        const API_KEY = process.env.AI_API_KEY;
        
        // Dynamischer System-Prompt: Begrüßung nur, wenn die History leer ist
        const isFirstMessage = !history || history.length === 0;
        const systemPrompt = `Du bist der ITECH-Assistent. 
        ${isFirstMessage ? "Begrüße den User freundlich zum ITECH-Ausleihsystem." : "KEINE Begrüßung mehr."}
        REGELN: 
        - Max 2 Sätze.
        - Frag nach Gerät (Laptop/iPad) und Dauer (max 8 Wochen).
        - Wenn alles klar ist, antworte EXAKT: "Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                temperature: 0.2
            })
        });

        const data = await response.json();
        return res.status(200).json({ reply: data.choices[0].message.content, actionPerformed: false });

    } catch (err) {
        return res.status(500).json({ reply: "Fehler: " + err.message });
    }
}