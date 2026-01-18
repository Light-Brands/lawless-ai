import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/icons',
  '/manifest.json',
  '/version.json',
  '/sw.js',
];

// Check if a path is a public route
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes and static assets
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Update Supabase session and check authentication
  const { supabaseResponse, user } = await updateSession(request);

  // If user is not authenticated, redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    // Add the original path as redirect target
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated - continue with the request
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
