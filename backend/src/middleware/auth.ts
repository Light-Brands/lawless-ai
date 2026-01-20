import { Request, Response, NextFunction } from 'express';

// API Key authentication middleware
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.BACKEND_API_KEY;

  // Skip auth if no key configured (development mode)
  if (!expectedKey) {
    return next();
  }

  if (apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};
