// api/ai.js
import { createClient } from '@supabase/supabase-js';

// Supabase Service Key für Server-Side Access (RLS umgehen, nur auf Server)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Method Not Allowed' });
  }

  try {
    const { message, userId } = req.body;
    if (!message || !userId) {
      return res.status(400).json({ reply: 'Fehlende Parameter' });
    }

    // 1️⃣ Alle Items aus loans abrufen
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('*');

    if (loansError) {
      console.error('Supabase Error:', loansError);
      return res.status(500).json({ reply: 'Fehler beim Laden der Geräte' });
    }

    // Items zählen, die noch keinem User zugewiesen sind
    const availableCounts = {};
    loans.forEach(l => {
      if (!l.user_id) {
        availableCounts[l.item_name] = (availableCounts[l.item_name] || 0) + 1;
      }
    });

    const availableText = Object.keys(availableCounts)
      .map(name => `${name}: ${availableCounts[name]} verfügbar`)
      .join(", ") || "Keine Geräte verfügbar";

    // 2️⃣ OpenAI API Request
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Du bist ein freundliches IT-Ausleihsystem. 
Nutze diese Informationen über verfügbare Geräte, um Fragen des Nutzers zu beantworten:
${availableText}
Antworten sollen präzise, freundlich und in eigenen Worten sein.`
          },
          { role: '