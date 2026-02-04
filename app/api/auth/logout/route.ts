import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const COOKIE_NAME = 'cardiology_session';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (token) {
      // Delete session from database
      await supabase
        .from('user_sessions')
        .delete()
        .eq('token', token);
    }

    const response = NextResponse.json({ success: true });

    // Clear cookie
    response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
