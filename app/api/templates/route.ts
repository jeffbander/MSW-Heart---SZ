import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - List all templates (with optional filters)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const isGlobal = searchParams.get('isGlobal');
    const ownerId = searchParams.get('ownerId');

    let query = supabase
      .from('schedule_templates')
      .select(`
        *,
        owner:providers(id, name, initials)
      `)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    if (isGlobal !== null) {
      query = query.eq('is_global', isGlobal === 'true');
    }

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST - Create new template
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, type, is_global, owner_id, created_by } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('schedule_templates')
      .insert({
        name,
        description: description || null,
        type: type || 'weekly',
        is_global: is_global !== false,
        owner_id: owner_id || null,
        created_by: created_by || null,
      })
      .select(`
        *,
        owner:providers(id, name, initials)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

// PUT - Update template metadata
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Only allow updating certain fields
    const allowedUpdates: Record<string, any> = {};
    if (updates.name !== undefined) allowedUpdates.name = updates.name;
    if (updates.description !== undefined) allowedUpdates.description = updates.description;
    if (updates.type !== undefined) allowedUpdates.type = updates.type;
    if (updates.is_global !== undefined) allowedUpdates.is_global = updates.is_global;
    if (updates.owner_id !== undefined) allowedUpdates.owner_id = updates.owner_id;

    const { data, error } = await supabase
      .from('schedule_templates')
      .update(allowedUpdates)
      .eq('id', id)
      .select(`
        *,
        owner:providers(id, name, initials)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete template
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('schedule_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
