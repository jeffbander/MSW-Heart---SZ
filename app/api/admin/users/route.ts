import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { requireRole, isAuthError } from '@/lib/auth';

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'super_admin');
    if (isAuthError(authResult)) return authResult;

    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, display_name, role, provider_id, allowed_service_ids, is_active, can_manage_testing, created_at, updated_at')
      .order('display_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'super_admin');
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const { username, password, display_name, role, provider_id, allowed_service_ids, can_manage_testing } = body;

    if (!username || !password || !display_name || !role) {
      return NextResponse.json(
        { error: 'Username, password, display_name, and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['super_admin', 'scheduler_full', 'scheduler_limited', 'provider', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        username: username.toLowerCase().trim(),
        password_hash,
        display_name,
        role,
        provider_id: provider_id || null,
        allowed_service_ids: allowed_service_ids || [],
        can_manage_testing: can_manage_testing || false,
      })
      .select('id, username, display_name, role, provider_id, allowed_service_ids, is_active, can_manage_testing, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'super_admin');
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const { id, password, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };

    // If password reset is requested, hash the new password
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.username;
    delete updateData.created_at;

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('id', id)
      .select('id, username, display_name, role, provider_id, allowed_service_ids, is_active, can_manage_testing, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'super_admin');
    if (isAuthError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Don't allow deleting yourself
    if (id === authResult.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete sessions first
    await supabase.from('user_sessions').delete().eq('user_id', id);

    // Delete user
    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
