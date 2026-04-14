import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ reply: "Nur POST erlaubt" });

    const { message, history, userId } = req.body;
    const msgUpper = message.toUpperCase().trim();

    try {
        // --- 1. ZUSCHREIBE LOGIK BEI "BESTÄTIGEN" ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            const fullText = (history || []).map(h => h.content).join(" ").toUpperCase() + " " + msgUpper;
            
            // --- NEU: DYNAMISCHE ZEIT-ERKENNUNG (Tage/Wochen) ---
            let daysToAdd = 7; // Standard: 1 Woche
            const timeMatch = fullText.match(/(\d+)\s*(TAG|W)/i); // Sucht nach "5 Tag..." oder "2 W..."
            
            if (timeMatch) {
                const num = parseInt(timeMatch[1]);
                const unit = timeMatch[2];
                // Wenn Einheit mit W beginnt (Woche/Wöchig), mal 7 rechnen
                daysToAdd = unit.startsWith("W") ? num * 7 : num;
            }

            // Cap bei 12 Wochen (84 Tage)
            if (daysToAdd > 84) daysToAdd = 84;

            // KATEGORIE FINDEN
            let finalCategory = "Laptop"; 
            if (fullText.includes("IPAD")) finalCategory = "iPad";
            else if (fullText.includes("IPHONE") || fullText.includes("HANDY")) finalCategory = "iPhone-Handy";
            else if (fullText.includes("DRUCKER") || fullText.includes("3D")) finalCategory = "3D-Drucker";

            const { data: freeItem, error: findError } = await supabase
                .from('loans')
                .select('id, item_name')
                .is('user_id', null)
                .ilike('item_name', `%${finalCategory}%`)
                .limit(1)
                .maybeSingle();

            if (findError || !freeItem) {
                return res.status(200).json({ 
                    reply: `Leider ist gerade kein freies Gerät der Kategorie "${finalCategory}" verfügbar.`, 
                    actionPerformed: false 
                });
            }

            // Rückgabedatum basierend auf der User-Eingabe berechnen
            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + daysToAdd); 

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
                    reply: `✅ Alles klar! Ich habe dir den ${freeItem.item_name} (ID: ${freeItem.id}) für ${daysToAdd} Tage zugeschrieben (Rückgabe am ${returnDate.toLocaleDateString()}).`, 
                    actionPerformed: true 
                });
            }
        }

        // --- 2. KI ANTWORT MIT STRENGEN REGELN ---
        const API_KEY = process.env.AI_API_KEY;
        const isFirst = !history || history.length === 0;
        
        const systemPrompt = `Du bist der ITECH-Assistent. 
        REGELN:
        1. MAXIMAL 4 SÄTZE.
        2. Begrüßung: ${isFirst ? 'Begrüße den User herzlich.' : 'KEINE Begrüßung (Status: bereits begrüßt).'}
        3. Inventar: Laptops, iPads, iPhone-Handys, 3D-Drucker.
        4. Ablauf-Logik:
           - Schritt A: Identifiziere Gerät UND Dauer (max 12 Wochen).
           - Schritt B: Wenn der User eine Dauer nennt (z.B. "4 Tage"), akzeptiere diese.
           - Schritt C: Sobald beides klar ist, antworte NUR: "Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        5. Wenn Infos fehlen, frage gezielt danach. Keine Höflichkeitsfloskeln nach Schritt A.`;

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
                temperature: 0.1 // Niedrige Temperatur für extrem präzises Befolgen der Regeln
            })
        });

        const aiData = await aiRes.json();
        return res.status(200).json({ 
            reply: aiData.choices[0].message.content, 
            actionPerformed: false 
        });

    } catch (err) {
        return res.status(200).json({ reply: "Fehler: " + err.message });
    }
}