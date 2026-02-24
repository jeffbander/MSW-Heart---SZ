import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireTestingAccess, isAuthError } from '@/lib/auth';

// GET /api/echo-templates - Get all templates
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('echo_schedule_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching echo templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch echo templates' },
      { status: 500 }
    );
  }
}

// POST /api/echo-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_schedule_templates')
      .insert({
        name,
        description: description || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating echo template:', error);
    return NextResponse.json(
      { error: 'Failed to create echo template' },
      { status: 500 }
    );
  }
}

// PUT /api/echo-templates - Update a template
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { id, name, description, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('echo_schedule_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating echo template:', error);
    return NextResponse.json(
      { error: 'Failed to update echo template' },
      { status: 500 }
    );
  }
}

// DELETE /api/echo-templates - Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('echo_schedule_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting echo template:', error);
    return NextResponse.json(
      { error: 'Failed to delete echo template' },
      { status: 500 }
    );
  }
}
