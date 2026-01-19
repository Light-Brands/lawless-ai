import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes that skip session refresh entirely
const SKIP_MIDDLEWARE = [
  '/_next',
  '/favicon.ico',
  '/icons',
  '/manifest.json',
  '/version.json',
  '/sw.js',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware entirely for static assets
  if (SKIP_MIDDLEWARE.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // For all other routes, refresh the Supabase session
  // This keeps the session alive and syncs cookies
  // Auth redirects are handled client-side by AuthGate
  const { supabaseResponse } = await updateSession(request);

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
