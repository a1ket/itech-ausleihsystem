import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import aiRouter from './api/ai.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', aiRouter); // <--- der Chat-Endpunkt

const PORT = 3000;
app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));