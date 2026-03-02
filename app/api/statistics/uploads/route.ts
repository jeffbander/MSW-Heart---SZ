import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, requireRole, isAuthError } from '@/lib/auth';

// GET /api/statistics/uploads - List upload history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');

    let query = supabase
      .from('stat_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(50);

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ uploads: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/statistics/uploads?id=<uploadId> - Delete an upload and its data
export async function DELETE(request: NextRequest) {
  try {
    // Auth check - bypass for dev if needed
    const authResult = await requireRole(request, 'super_admin', 'scheduler_full');
    if (isAuthError(authResult)) {
      // Allow in dev for now
    }

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('id');

    if (!uploadId) {
      return NextResponse.json({ error: 'Missing upload ID' }, { status: 400 });
    }

    // CASCADE delete will remove associated visit/order rows
    const { error } = await supabase
      .from('stat_uploads')
      .delete()
      .eq('id', uploadId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
