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
        // --- 1. DATENBANK-CHECK ---
        const { count } = await supabase
            .from('user_chats')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', String(userId));
        
        const isFirstMessage = count === 0;

        // --- 2. BESTÄTIGUNGS-LOGIK (Unverändert) ---
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

        // --- 3. SYSTEM PERSONA (Optimiert für Kontext-Verständnis) ---
        const masterPrompt = `Du bist der ITECH-Concierge. 
        DEINE REGLEN:
        1. ANALYSIERE den Chatverlauf BEVOR du antwortest.
        2. VERGISS NIEMALS Informationen, die der User bereits gegeben hat (Gerät oder Dauer).
        3. WENN der User fragt "Was gibt es noch?", nenne die anderen Geräte, aber behalte das bereits gewählte Gerät im Kopf ("Du hast ja schon X gewählt, zusätzlich haben wir...").
        4. BESTÄTIGE immer kurz den Status, bevor du eine Frage stellst (Bsp: "Okay, 3D-Drucker ist notiert. Wie lange brauchst du ihn?").
        5. KEINE Begrüßung mehr, wenn der Verlauf nicht leer ist.
        6. Wenn Gerät UND Dauer bekannt sind, sage NUR: "Super, dann können wir das festmachen. Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        7. Max 3 Sätze.
        ${isFirstMessage ? "Da dies die erste Nachricht ist: Begrüße den User herzlich und biete Hilfe an." : ""}`;

        // --- 4. KI ANFRAGE ---
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
                temperature: 0.3 // Etwas niedriger für präziseres Halten an Regeln
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