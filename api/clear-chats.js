import { createClient } from '@supabase/supabase-js';

// Supabase-Client initialisieren
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    // Nur POST-Anfragen zulassen
    if (req.method !== 'POST') return res.end();

    const { userId } = req.body;

    // Chat-Historie des Users löschen
    await supabase
        .from('user_chats')
        .delete()
        .eq('user_id', String(userId));

    // HTTP-Verbindung schließen
    res.end();
}