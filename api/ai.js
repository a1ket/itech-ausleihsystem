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
        // --- LOGIK: WELCHES GERÄT WILL DER USER? ---
        // Wir schauen, was in der Nachricht steht
        let requestedCategory = null;
        if (msgUpper.includes("LAPTOP")) requestedCategory = "Laptop";
        if (msgUpper.includes("IPAD")) requestedCategory = "iPad";
        if (msgUpper.includes("IPHONE") || msgUpper.includes("HANDY")) requestedCategory = "iPhone-Handy";
        if (msgUpper.includes("DRUCKER") || msgUpper.includes("3D")) requestedCategory = "3D-Drucker";

        // --- ZUSCHREIBE LOGIK BEI "BESTÄTIGEN" ---
        if (msgUpper.includes("BESTÄTIGEN")) {
            // Wir schauen in der History nach, was das letzte gewollte Gerät war
            const fullText = history.map(h => h.content).join(" ").toUpperCase() + " " + msgUpper;
            let finalCategory = "Laptop"; // Default
            if (fullText.includes("IPAD")) finalCategory = "iPad";
            if (fullText.includes("IPHONE", "Handy") || fullText.includes("HANDY")) finalCategory = "iPhone-Handy";
            if (fullText.includes("3D DRUCKER") || fullText.includes("3D")) finalCategory = "3D-Drucker";

            // Suche ein freies Gerät der passenden Kategorie
            const { data: freeItem, error: findError } = await supabase
                .from('loans')
                .select('id, item_name')
                .is('user_id', null)
                .ilike('item_name', `%${finalCategory}%`) // Sucht nach dem Namen (z.B. %iPad%)
                .limit(1)
                .maybeSingle();

            if (findError || !freeItem) {
                return res.status(200).json({ reply: `Leider ist gerade kein freies ${finalCategory} verfügbar.`, actionPerformed: false });
            }

            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + 42); 

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
                    reply: `✅ Alles klar! Ich habe dir das Gerät "${freeItem.item_name}" (ID: ${freeItem.id}) zugeschrieben.`, 
                    actionPerformed: true 
                });
            }
        }

        // --- KI ANTWORT MIT ALLEN GERÄTEN ---
        const API_KEY = process.env.AI_API_KEY;
        const isFirst = !history || history.length === 0;
        
        const systemPrompt = `Du bist der ITECH-Assistent. 
        REGELN:
        1. Max 4 Sätze. Begrüßung NUR bei der ersten Nachricht (${isFirst ? 'AKTIVIERT' : 'DEAKTIVIERT'}).
        2. Inventar: Laptops, iPads, iPhone-Handys, 3D-Drucker.
        3. Ablauf-Logik:
          - Schritt A: Gerät identifizieren.
          - Schritt B: Dauer identifizieren (Max 12 Wochen).
          - Schritt C: Sobald BEIDES (Gerät UND Dauer) bekannt ist, antworte EXAKT: "Bitte schreibe 'BESTÄTIGEN' um die Ausleihe abzuschließen."
        4. Fehlende Info: Wenn die Dauer fehlt, frage gezielt danach. Wenn das Gerät fehlt, frage gezielt danach.
        5. Keine unnötigen Floskeln nach der Identifikation.`;

        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
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
        return res.status(200).json({ reply: "Fehler: " + err.message });
    }
}