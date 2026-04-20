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
        // --- 1. TÄGLICHE BEGRÜSSUNG LOGIK ---
        // Wir prüfen, wann der User das letzte Mal geschrieben hat
        const { data: lastMsg } = await supabase
            .from('user_chats')
            .select('created_at')
            .eq('user_id', String(userId))
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const today = new Date().toDateString();
        const lastDate = lastMsg ? new Date(lastMsg.created_at).toDateString() : null;
        const shouldGreet = lastDate !== today;

        // --- 2. ZUSCHREIBE LOGIK BEI "BESTÄTIGEN" ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            const fullText = (history || []).map(h => h.content).join(" ").toUpperCase() + " " + msgUpper;
            
            // Dauer ermitteln
            let daysToAdd = 7;
            const timeMatch = fullText.match(/(\d+)\s*(TAG|W)/i);
            if (timeMatch) {
                const num = parseInt(timeMatch[1]);
                daysToAdd = timeMatch[2].startsWith("W") ? num * 7 : num;
            }
            if (daysToAdd > 84) daysToAdd = 84;

            // Kategorie ermitteln
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

        // --- 3. KI MIT MEISTER-COMMAND ---
        const systemPrompt = `Du bist ein freundlicher, geduldiger ITECH-Assistent. 
        DEINE REGELN:
        1. BEGRÜSSUNG: Wenn 'shouldGreet' wahr ist, begrüße den User herzlich (z.B. "Hallo! Schön, dass du wieder da bist. Wie kann ich dir heute bei der Ausleihe helfen?"). Ansonsten: Überspringe die Begrüßung komplett und komm direkt zum Punkt.
        2. GEDULD: Frage erst nach dem Gerät (Laptop, iPad, iPhone, Drucker), dann nach der Dauer.
        3. PRÄZISION: Fordere erst DANN zur Bestätigung ("Schreibe BESTÄTIGEN") auf, wenn das Gerät UND die Dauer bekannt sind.
        4. LÄNGE: Maximal 3 kurze Sätze. Kein Gelaber.
        5. STATUS: shouldGreet = ${shouldGreet}`;

        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
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
        return res.status(200).json({ reply: aiData.choices[0].message.content, actionPerformed: false });

    } catch (err) {
        return res.status(200).json({ reply: "Kleiner Fehler im System, versuch es bitte gleich nochmal." });
    }
}