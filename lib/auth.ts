import { NextRequest, NextResponse } from 'next/server';
import { supabase } from './supabase';

export type UserRole = 'super_admin' | 'scheduler_full' | 'scheduler_limited' | 'provider' | 'viewer';

export type TestingFeature = 'edit_assignments' | 'edit_pto' | 'manage_templates' | 'manage_rooms';

export interface TestingPermissions {
  edit_assignments?: boolean;
  edit_pto?: boolean;
  manage_templates?: boolean;
  manage_rooms?: boolean;
}

export interface AppUser {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  provider_id: string | null;
  allowed_service_ids: string[];
  is_active: boolean;
  can_manage_testing: boolean;
  testing_permissions: TestingPermissions | null;
  created_at: string;
  updated_at: string;
}

const COOKIE_NAME = 'cardiology_session';

/**
 * Extract session token from the request cookie
 */
function getSessionToken(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Get the authenticated user from the request.
 * Returns null if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<AppUser | null> {
  const token = getSessionToken(request);
  if (!token) { console.log('[auth] no token found'); return null; }

  // Look up session
  const { data: session, error: sessionError } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (sessionError || !session) {
    console.log('[auth] session lookup failed:', sessionError?.message || 'no session found');
    return null;
  }

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await supabase.from('user_sessions').delete().eq('token', token);
    return null;
  }

  // Look up user
  const { data: user, error: userError } = await supabase
    .from('app_users')
    .select('id, username, display_name, role, provider_id, allowed_service_ids, is_active, can_manage_testing, testing_permissions, created_at, updated_at')
    .eq('id', session.user_id)
    .single();

  if (userError || !user || !user.is_active) return null;

  return user as AppUser;
}

/**
 * Require specific roles for an API route.
 * Returns the user if authorized, or a NextResponse error if not.
 */
export async function requireRole(
  request: NextRequest,
  ...roles: UserRole[]
): Promise<AppUser | NextResponse> {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  return user;
}

/**
 * Check if the result of requireRole is an error response
 */
export function isAuthError(result: AppUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Check if a user has a specific testing feature permission.
 * Super admins always have all features.
 * If testing_permissions is null (legacy), all features are enabled.
 */
export function hasTestingFeature(user: AppUser, feature: TestingFeature): boolean {
  if (user.role === 'super_admin') return true;
  if (!user.can_manage_testing) return false;
  // Null permissions = all features enabled (backward compatible)
  if (!user.testing_permissions) return true;
  return user.testing_permissions[feature] !== false;
}

/**
 * Require testing (echo) management access.
 * Optionally checks a specific feature permission.
 * Returns user if super_admin or has can_manage_testing flag (+ feature if specified).
 * Returns 401 if not authenticated, 403 if insufficient permissions.
 */
export async function requireTestingAccess(
  request: NextRequest,
  feature?: TestingFeature
): Promise<AppUser | NextResponse> {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  if (user.role !== 'super_admin' && !user.can_manage_testing) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  if (feature && !hasTestingFeature(user, feature)) {
    return NextResponse.json(
      { error: 'Insufficient permissions for this feature' },
      { status: 403 }
    );
  }

  return user;
}

/**
 * Check if a user can edit a specific service
 */
export function canUserEditService(user: AppUser, serviceId: string): boolean {
  if (user.role === 'super_admin' || user.role === 'scheduler_full') {
    return true;
  }
  if (user.role === 'scheduler_limited') {
    return user.allowed_service_ids.includes(serviceId);
  }
  return false;
}
