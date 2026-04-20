import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt" });

    const { message, history, userId } = req.body;
    const msgUpper = message.toUpperCase().trim();

    try {
        // --- BESTÄTIGUNGS-LOGIK ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            const fullText = (history || []).map(h => h.content).join(" ").toUpperCase() + " " + msgUpper;
            let daysToAdd = 7;
            const timeMatch = fullText.match(/(\d+)\s*(TAG|W)/i);
            if (timeMatch) {
                const num = parseInt(timeMatch[1]);
                daysToAdd = timeMatch[2].startsWith("W") ? num * 7 : num;
            }
            if (daysToAdd > 84) daysToAdd = 84;

            let finalCategory = "Laptop";
            if (fullText.includes("IPAD")) finalCategory = "iPad";
            else if (fullText.includes("IPHONE") || fullText.includes("HANDY")) finalCategory = "iPhone-Handy";
            else if (fullText.includes("DRUCKER") || fullText.includes("3D")) finalCategory = "3D-Drucker";

            const { data: freeItem } = await supabase.from('loans').select('id, item_name').is('user_id', null).ilike('item_name', `%${finalCategory}%`).limit(1).maybeSingle();
            
            if (!freeItem) return res.status(200).json({ reply: `Tut mir leid, es ist momentan kein ${finalCategory} verfügbar.`, actionPerformed: false });

            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + daysToAdd);
            await supabase.from('loans').update({ user_id: String(userId), loan_date: new Date().toISOString(), return_date: returnDate.toISOString() }).eq('id', freeItem.id);
            
            return res.status(200).json({ reply: `✅ Reserviert: ${freeItem.item_name} für ${daysToAdd} Tage.`, actionPerformed: true });
        }

        // --- DER STURE LOGIK-PROMPT ---
        const masterPrompt = `Du bist ein reines Ausleih-Tool. Deine einzige Aufgabe ist es, Gerät und Dauer zu sammeln.
        
        SCHRITT-FÜR-SCHRITT-ANWEISUNG:
        1. Lies den GESAMTEN Verlauf.
        2. Prüfe: Ist ein Gerät (Laptop, iPad, iPhone-Handy, 3D-Drucker) bekannt?
        3. Prüfe: Ist eine Dauer bekannt?
        4. WENN BEIDES BEKANNT: Schreibe EXAKT: "Super, das ist notiert. Bitte schreibe BESTÄTIGEN um die Ausleihe abzuschließen."
        5. WENN EINES FEHLT: Frage NUR nach dem fehlenden Teil.
        6. NIEMALS nach Dingen fragen, die schon im Verlauf stehen.
        7. Keine Begrüßung. Keine Floskeln. Max 1 Satz.`;

        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: masterPrompt },
                    ...(history || []),
                    { role: "user", content: message }
                ],
                temperature: 0.0 // Null Toleranz für Halluzinationen
            })
        });

        const aiData = await aiRes.json();
        const reply = aiData.choices[0].message.content;
        
        // Speichern
        await supabase.from('user_chats').insert([{ user_id: userId, message: message, role: 'user' }]);
        await supabase.from('user_chats').insert([{ user_id: userId, message: reply, role: 'assistant' }]);

        return res.status(200).json({ reply: reply, actionPerformed: false });

    } catch (err) {
        return res.status(200).json({ reply: "Systemfehler." });
    }  
}