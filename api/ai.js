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
        const { count } = await supabase.from('user_chats').select('*', { count: 'exact', head: true }).eq('user_id', String(userId));
        const isFirstMessage = count === 0;

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
            
            return res.status(200).json({ reply: `✅ Erledigt! Ich habe dir den ${freeItem.item_name} für ${daysToAdd} Tage reserviert (Rückgabe: ${returnDate.toLocaleDateString()}).`, actionPerformed: true });
        }

        // --- STRIKTES SYSTEM-PROMPT ---
        const masterPrompt = `Du bist der Admin des ITECH-Ausleihsystems.
        DEIN INVENTAR (NUR DIESE KATEGORIEN SIND ERLAUBT):
        1. Laptop
        2. iPad
        3. iPhone-Handy
        4. 3D-Drucker
        
        REGLEN FÜR DICH:
        1. Antworte kurz, direkt und verbindlich.
        2. Wenn der User ein Gerät nennt, das in der Liste ist: Akzeptiere es sofort und frage nach der Dauer.
        3. Wenn der User ein Gerät *wechselt* (z.B. "doch lieber Laptop"), bestätige den Wechsel und vergiss das alte Gerät.
        4. Wenn der User fragt, was es gibt: Liste NUR die 4 oben genannten Geräte auf.
        5. Wenn Gerät und Dauer vorliegen: Sage: "Perfekt, Gerät und Dauer sind erfasst. Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        6. Keine Begrüßung nach der ersten Nachricht.
        7. Max 2 Sätze.
        ${isFirstMessage ? "Da dies die erste Nachricht ist: Begrüße den User herzlich." : ""}`;

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
                temperature: 0.2 // Sehr niedrig für maximale Disziplin
            })
        });

        const aiData = await aiRes.json();
        const reply = aiData.choices[0].message.content;
        
        await supabase.from('user_chats').insert([{ user_id: userId, message: message, role: 'user' }]);
        await supabase.from('user_chats').insert([{ user_id: userId, message: reply, role: 'assistant' }]);

        return res.status(200).json({ reply: reply, actionPerformed: false });

    } catch (err) {
        return res.status(200).json({ reply: "Systemfehler, bitte nochmal versuchen." });
    }  
}