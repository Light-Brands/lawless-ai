import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require PIN verification
const PUBLIC_ROUTES = [
  '/api/auth/pin',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/icons',
  '/manifest.json',
  '/version.json',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check PIN verification for all other routes
  const pinVerified = request.cookies.get('pin_verified')?.value === 'true';

  // If PIN is required and not verified, block API routes
  if (!pinVerified && process.env.APP_PIN) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'PIN verification required' },
        { status: 401 }
      );
    }
    // For pages, PinGate component handles the PIN entry UI
  }

  return NextResponse.next();
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
