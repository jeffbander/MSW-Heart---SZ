import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

const COOKIE_NAME = 'cardiology_session';
const SESSION_DURATION_DAYS = 7;

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Look up user
    const { data: user, error } = await supabase
      .from('app_users')
      .select('id, username, password_hash, display_name, role, provider_id, allowed_service_ids, is_active')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is disabled. Contact an administrator.' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create session token
    const token = crypto.randomUUID() + '-' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    // Store session
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Build response with user data (exclude password_hash)
    const userData = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      provider_id: user.provider_id,
      allowed_service_ids: user.allowed_service_ids,
    };

    const response = NextResponse.json({ user: userData });

    // Set httpOnly cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
