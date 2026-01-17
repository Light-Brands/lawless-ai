/**
 * Vercel Serverless Function Entry Point
 *
 * This file exports the Express app for Vercel's serverless functions.
 *
 * NOTE: The Claude CLI integration will NOT work on Vercel because:
 * 1. Vercel's serverless environment doesn't have Claude CLI installed
 * 2. Serverless functions have execution time limits
 *
 * For Vercel deployment with full functionality, you would need to:
 * 1. Use the Claude API instead of CLI
 * 2. Set ANTHROPIC_API_KEY in Vercel environment variables
 *
 * The static frontend will work correctly on Vercel.
 */

import app from '../server/index.js';

export default app;
