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
        // --- 1. VERLAUF DIREKT AUS DB HOLEN & "SCHNEIDEN" ---
        const { data: rawHistory } = await supabase
            .from('user_chats')
            .select('role, message')
            .eq('user_id', String(userId))
            .order('created_at', { ascending: true });

        // LOGIK: Finde die letzte Bestätigung (Nachricht mit "✅")
        let historyToUse = rawHistory || [];
        const lastConfirmationIndex = historyToUse.map(h => h.message).reverse().findIndex(m => m.includes("✅"));

        // Wenn eine Bestätigung gefunden wurde, lösche alles davor
        if (lastConfirmationIndex !== -1) {
            const actualIndex = historyToUse.length - lastConfirmationIndex;
            historyToUse = historyToUse.slice(actualIndex);
        }

        const formattedHistory = historyToUse.map(h => ({
            role: h.role,
            content: h.message
        }));

        // --- 2. BESTÄTIGUNGS-LOGIK (DIE RADIKAL-LÖSUNG) ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            // ... (Hier steht deine Logik zum Berechnen der Dauer, Kategorien, etc.)
            
            // ... (Hier steht deine Logik zur Datenbank-Aktualisierung der Ausleihe)
            await supabase.from('loans').update({ 
                user_id: String(userId), 
                loan_date: new Date().toISOString(), 
                return_date: new Date(Date.now() + daysToAdd * 86400000).toISOString() 
            }).eq('id', freeItem.id);
            
            // --- HIER LÖSCHEN WIR ALLES ---
            // Ab jetzt ist der Chat für die KI komplett leer.
            await supabase.from('user_chats').delete().eq('user_id', String(userId));
            
            return res.status(200).json({ 
                reply: `✅ Reserviert: ${freeItem.item_name} für ${daysToAdd} Tage. Alles Weitere wurde aus dem Verlauf gelöscht.`, 
                actionPerformed: true 
            });
        }

        // --- 3. SYSTEM PROMPT ---
        // Wir zwingen die KI, die History als absolut zu betrachten.
        const masterPrompt = `Du bist ein Geräte Ausleih-Assistent. 
        INVENTAR: Laptop, iPad, iPhone-Handy, 3D-Drucker.
        
        ANWEISUNG:
        1. Analysiere die Nachrichtenhistorie.
        2. Wenn Gerät und Dauer bereits genannt wurden, sage: "Perfekt, alles notiert. Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        3. Behandle jede Nachricht nach einem erfolgreichen 'BESTÄTIGEN' als komplett neuen Vorgang und ignoriere dabei alle vorherigen Angaben zu Gerät oder Dauer.
        4. Wenn nur eines bekannt ist, bestätige das und frage nach dem anderen Teil.
        5. Wenn der User widerspricht oder korrigiert, akzeptiere das sofort als neue Wahrheit.
        6. Begrüßung nur nach der ersten Nachricht. Kurz und qualitativ fassen.`;

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