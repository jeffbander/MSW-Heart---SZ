import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/pto-requests/[id] - Get a single PTO request
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('pto_requests')
      .select(`
        *,
        provider:providers(id, name, initials, role)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'PTO request not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching PTO request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PTO request' },
      { status: 500 }
    );
  }
}

// DELETE /api/pto-requests/[id] - Delete a PTO request (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if the request exists
    const { data: existing, error: fetchError } = await supabase
      .from('pto_requests')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'PTO request not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    const { error } = await supabase
      .from('pto_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting PTO request:', error);
    return NextResponse.json(
      { error: 'Failed to delete PTO request' },
      { status: 500 }
    );
  }
}
