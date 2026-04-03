import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/auditLog';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    const body = await request.json();
    const { name, initials, role, default_room_count, capabilities } = body;

    if (!name || !initials || !role) {
      return NextResponse.json(
        { error: 'Name, initials, and role are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('providers')
      .insert({
        name,
        initials,
        role,
        default_room_count: default_room_count || 0,
        capabilities: capabilities || []
      })
      .select()
      .single();

    if (error) throw error;

    if (authUser) {
      logAudit(authUser, 'create', 'provider', data.id, { name, initials, role });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating provider:', error);
    return NextResponse.json(
      { error: 'Failed to create provider' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('providers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (authUser) {
      logAudit(authUser, 'update', 'provider', id, { name: data.name, ...updates });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating provider:', error);
    return NextResponse.json(
      { error: 'Failed to update provider' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (authUser) {
      logAudit(authUser, 'delete', 'provider', id, {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider' },
      { status: 500 }
    );
  }
}
