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
        // --- 1. ROBUSTE BEGRÜSSUNGS-LOGIK ---
        // Wenn history leer oder nicht vorhanden ist -> Begrüßen. Sonst nicht.
        const shouldGreet = !history || history.length === 0;

        // --- 2. BESTÄTIGUNGS-LOGIK ---
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

            const { data: freeItem } = await supabase
                .from('loans')
                .select('id, item_name')
                .is('user_id', null)
                .ilike('item_name', `%${finalCategory}%`)
                .limit(1)
                .maybeSingle();

            if (!freeItem) return res.status(200).json({ reply: `Tut mir leid, es ist gerade kein freies ${finalCategory} mehr verfügbar.`, actionPerformed: false });

            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + daysToAdd);

            await supabase.from('loans').update({ 
                user_id: String(userId), 
                loan_date: new Date().toISOString(),
                return_date: returnDate.toISOString()
            }).eq('id', freeItem.id);

            return res.status(200).json({ 
                reply: `✅ Erledigt! Ich habe dir den ${freeItem.item_name} für ${daysToAdd} Tage reserviert (Rückgabe: ${returnDate.toLocaleDateString()}).`, 
                actionPerformed: true 
            });
        }

        // --- 3. SYSTEM PERSONA & REGLEN ---
        const systemPersona = `Du bist ein charmanter, hilfsbereiter IT-Concierge für das ITECH-Ausleihsystem. Du schreibst IMMER in perfektem Deutsch mit korrekter Grammatik und Zeichensetzung. Du bist effizient, freundlich und hilfsbereit. Deine Aufgabe ist es, User bei der Ausleihe von Laptops, iPads, iPhone-Handys und 3D-Druckern zu unterstützen. Wenn Gerät und Dauer bekannt sind, sag: "Super, dann können wir das festmachen. Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen." Wenn etwas fehlt, frage gezielt danach. Halte dich kurz (max 3 Sätze).`;
        
        const greetingInstruction = shouldGreet 
            ? "Da dies die erste Nachricht des Users ist: Begrüße ihn herzlich und biete Hilfe bei der Geräteausleihe an." 
            : "Antworte direkt und sachlich auf das Anliegen des Users, ohne Begrüßung.";

        const masterPrompt = `${systemPersona} ${greetingInstruction}`;

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
                temperature: 0.5
            })
        });

        const aiData = await aiRes.json();
        
        // --- 5. VERLAUF SPEICHERN (Damit die KI sich für das nächste Mal erinnert) ---
        await supabase.from('user_chats').insert([{ user_id: userId, message: message, role: 'user' }]);
        await supabase.from('user_chats').insert([{ user_id: userId, message: aiData.choices[0].message.content, role: 'assistant' }]);

        return res.status(200).json({ reply: aiData.choices[0].message.content, actionPerformed: false });

    } catch (err) {
        return res.status(200).json({ reply: "Kleiner Systemfehler, bitte nochmal versuchen." });
    }  
}