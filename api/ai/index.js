import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { message, userId } = req.body;
    const msg = message.toLowerCase();

    // 1. STUFE: Bestätigung prüfen
    if (msg === "bestätige") {
        // Suche ein freies Gerät (Beispiel: Laptop), das noch niemandem gehört
        const { data: freeItem, error: findError } = await supabase
            .from('loans')
            .select('id, item_name')
            .is('user_id', null) // Nur Geräte, die noch frei sind
            .limit(1)
            .single();

        if (findError || !freeItem) {
            return res.status(200).json({ reply: "Leider ist gerade kein Gerät verfügbar.", actionPerformed: false });
        }

        // Frist berechnen (6 Wochen ab jetzt)
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + (6 * 7));

        // JETZT DAS UPDATE (Zuschreiben statt neu erstellen)
        const { error: updateError } = await supabase
            .from('loans')
            .update({ 
                user_id: userId, 
                loan_date: new Date().toISOString(),
                return_date: returnDate.toISOString()
            })
            .eq('id', freeItem.id); // Genau dieses eine freie Gerät nehmen

        if (!updateError) {
            return res.status(200).json({ 
                reply: `Erfolgreich! Der ${freeItem.item_name} wurde dir bis zum ${returnDate.toLocaleDateString()} zugeschrieben.`, 
                actionPerformed: true 
            });
        }
    }

    // 2. STUFE: Die KI-Logik (Fragerunde)
    // Hier rufen wir deine KI API auf (OpenAI/Gemini)
    const prompt = `Du bist der ITECH-Assistent. Ein User will ein Gerät ausleihen. 
    1. Frag ihn nach dem Gerät (Laptop/iPad) und der Dauer (max 6 Wochen).
    2. Wenn alle Infos da sind, sag: "Bitte schreibe 'BESTÄTIGE' um die Ausleihe abzuschließen."
    Antworte kurz. User-Nachricht: ${message}`;

    // ... (Hier dein Fetch-Aufruf an OpenAI/Gemini mit dem prompt)
    
    // Beispiel-Antwort falls Bestätigung noch fehlt:
    res.status(200).json({ reply: "Welches Gerät möchtest du leihen und für wie viele Wochen (max. 6)?", actionPerformed: false });
}