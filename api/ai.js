import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt" });

    const { message, userId } = req.body; // Wir ignorieren 'history' vom Frontend
    const msgUpper = message.toUpperCase().trim();

    try {
        // --- 1. VERLAUF DIREKT AUS DB HOLEN (Garantierte 100% Kontext) ---
        const { data: chatHistory } = await supabase
            .from('user_chats')
            .select('role, message')
            .eq('user_id', String(userId))
            .order('created_at', { ascending: true })
            .limit(10); // Die letzten 10 Nachrichten reichen völlig aus

        const formattedHistory = (chatHistory || []).map(h => ({
            role: h.role,
            content: h.message
        }));

        // --- 2. BESTÄTIGUNGS-LOGIK ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            // (Logik bleibt identisch)
            const fullText = formattedHistory.map(h => h.content).join(" ").toUpperCase() + " " + msgUpper;
            
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

        // --- 3. SYSTEM PROMPT ---
        // Wir zwingen die KI, die History als absolut zu betrachten.
        const masterPrompt = `Du bist ein reines Ausleih-Tool. 
        INVENTAR: Laptop, iPad, iPhone-Handy, 3D-Drucker.
        
        ANWEISUNG:
        1. Analysiere die Nachrichtenhistorie.
        2. Wenn Gerät und Dauer bereits genannt wurden, sage: "Perfekt, alles notiert. Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        3. Wenn nur eines bekannt ist, bestätige das und frage nach dem anderen Teil.
        4. Wenn der User widerspricht oder korrigiert, akzeptiere das sofort als neue Wahrheit.
        5. Keine Begrüßung. Kurz und qualitativ fassen.`;

        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: masterPrompt },
                    ...formattedHistory, // Hier nutzen wir den sauberen Verlauf aus der DB
                    { role: "user", content: message }
                ],
                temperature: 0.0 
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