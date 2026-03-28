export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  // Beispiel-Antwort der KI (kann durch OpenAI API ersetzt werden)
  const reply = `Echo: ${message}`;

  res.status(200).json({ reply });
}