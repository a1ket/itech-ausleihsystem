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
            
            if (!freeItem) return res.status(200).json({ reply: `Tut mir leid, es ist gerade kein freies ${finalCategory} mehr verfügbar.`, actionPerformed: false });

            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + daysToAdd);
            await supabase.from('loans').update({ user_id: String(userId), loan_date: new Date().toISOString(), return_date: returnDate.toISOString() }).eq('id', freeItem.id);
            
            return res.status(200).json({ reply: `✅ Erledigt! Reserviert: ${freeItem.item_name} für ${daysToAdd} Tage.`, actionPerformed: true });
        }

        // --- INTELLIGENTER SYSTEM PROMPT ---
        const masterPrompt = `Du bist ein hilfsbereiter IT-Concierge für das ITECH-Ausleihsystem. 
        VERFÜGBARE GERÄTE: Laptops, iPads, iPhone-Handys, 3D-Drucker, Laser-Cutter, VR-Brillen.
        
        REGELN:
        1. Antworte immer zuerst auf die Frage des Users. Sei hilfreich und höflich.
        2. Merke dir Gerät und Dauer aus dem Verlauf. Frage nur nach, wenn etwas fehlt.
        3. Wenn Gerät und Dauer bekannt sind, sage: "Super, das können wir so machen. Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        4. KEINE Begrüßung außer bei der ersten Nachricht.
        5. Vermeide leere Formulare. Antworte in natürlichem, gutem Deutsch.
        6. Wenn der User nach verfügbaren Geräten fragt, nenne die Liste oben.
        ${isFirstMessage ? "Da dies die erste Nachricht ist: Begrüße den User kurz." : "Schreibe keine Begrüßung."}`;

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
                temperature: 0.3
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