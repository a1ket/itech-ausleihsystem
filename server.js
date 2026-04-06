import express from 'express';
import cors from 'cors';
import aiHandler from './api/ai.js'; 

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ai', aiHandler); 

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
    console.log(`KI-Route bereit unter http://localhost:${PORT}/api/ai`);
});