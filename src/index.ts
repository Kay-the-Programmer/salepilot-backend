import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './api';
import { errorMiddleware } from './middleware/error.middleware';
import './types/request'; 
import './init_db'; // Initialize database tables

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json({ limit: '50mb' })); // Increase JSON body size limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increase URL encoded body size limit

// --- API Routes ---
app.use('/api', apiRoutes);

// --- Basic Route ---
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('SalePilot Backend is running!');
});

// --- Error Handling ---
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
