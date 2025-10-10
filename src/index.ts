import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './swagger.config';
import apiRoutes from './api';
import { errorMiddleware } from './middleware/error.middleware';
import './types/request';
import './init_db'; // Initialize database tables
import path from 'path';
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
// Configure CORS with specific options suitable for Vercel/Render
const allowedOrigins: (string | RegExp)[] = [
  process.env.FRONTEND_URL || '',
  /https?:\/\/.+\.vercel\.app$/,
  /https?:\/\/.+\.onrender\.com$/,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://192.168.1.101:5173',
].filter(Boolean) as (string | RegExp)[];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser tools
    const isAllowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? origin === o : (o as RegExp).test(origin)
    );
    if (isAllowed) return callback(null, true);
    return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Store-Id', 'X-Tenant-Id', 'x-store-id', 'x-tenant-id'],
  // Include both canonical and lowercase forms for robustness across environments
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- API Routes ---
app.use('/api', apiRoutes);

// --- Swagger Documentation ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SalePilot API Documentation'
}));

// --- Basic Route ---
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('SalePilot Backend is running! API Documentation available at <a href="/api-docs">/api-docs</a>');
});


// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Error Handling ---
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});