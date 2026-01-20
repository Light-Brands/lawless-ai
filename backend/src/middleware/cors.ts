import cors from 'cors';

// CORS configuration
export const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'https://lawless-ai.vercel.app'
].filter(Boolean) as string[];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
});
