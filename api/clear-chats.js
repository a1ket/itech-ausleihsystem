import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    // Nur POST erlauben
    if (req.method !== 'POST') return res.status(405).end();

    const { userId } = req.body;

    try {
        // Lösche alle Einträge, die zu diesem User gehören
        const { error } = await supabase
            .from('user_chats')
            .delete()
            .eq('user_id', String(userId));

        if (error) throw error;
        
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("Fehler beim Löschen der Chats:", err);
        return res.status(500).json({ error: "Löschen fehlgeschlagen" });
    }
}