import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const APP_PIN = process.env.APP_PIN || '8888';

// Cookie settings
const PIN_COOKIE_NAME = 'pin_verified';
const PIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * GET /api/auth/pin - Check if PIN is verified
 */
export async function GET(request: NextRequest) {
  const pinVerified = request.cookies.get(PIN_COOKIE_NAME)?.value;

  return NextResponse.json({
    verified: pinVerified === 'true',
  });
}

/**
 * POST /api/auth/pin - Verify PIN and set cookie
 */
export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { verified: false, error: 'PIN is required' },
        { status: 400 }
      );
    }

    // Verify PIN
    if (pin !== APP_PIN) {
      return NextResponse.json(
        { verified: false, error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // PIN is correct - set cookie
    const response = NextResponse.json({ verified: true });

    response.cookies.set(PIN_COOKIE_NAME, 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: PIN_COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('PIN verification error:', error);
    return NextResponse.json(
      { verified: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/pin - Clear PIN verification (logout-like)
 */
export async function DELETE() {
  const response = NextResponse.json({ verified: false });

  response.cookies.set(PIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
