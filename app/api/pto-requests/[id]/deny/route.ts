import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPTODenialEmail } from '@/lib/email';

// POST /api/pto-requests/[id]/deny - Deny a PTO request
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { admin_name, admin_comment } = body;

    if (!admin_name) {
      return NextResponse.json(
        { error: 'Admin name is required' },
        { status: 400 }
      );
    }

    if (!admin_comment) {
      return NextResponse.json(
        { error: 'A reason is required when denying a request' },
        { status: 400 }
      );
    }

    // First check if the request exists and is pending
    const { data: existing, error: fetchError } = await supabase
      .from('pto_requests')
      .select('status')
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

    // Check if already processed
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Request has already been ${existing.status}` },
        { status: 400 }
      );
    }

    // Update the request status to denied
    const { data, error } = await supabase
      .from('pto_requests')
      .update({
        status: 'denied',
        reviewed_by_admin_name: admin_name,
        reviewed_at: new Date().toISOString(),
        admin_comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        provider:providers(id, name, initials, role)
      `)
      .single();

    if (error) throw error;

    // Send email notification to provider
    try {
      await sendPTODenialEmail({
        providerName: data.provider?.name || 'Provider',
        providerEmail: data.provider?.email, // Note: email field may not exist yet
        startDate: data.start_date,
        endDate: data.end_date,
        leaveType: data.leave_type,
        timeBlock: data.time_block,
        adminName: admin_name,
        adminComment: admin_comment,
      });
    } catch (emailError) {
      console.error('Failed to send denial email:', emailError);
      // Don't fail - the denial was successful
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error denying PTO request:', error);
    return NextResponse.json(
      { error: 'Failed to deny PTO request' },
      { status: 500 }
    );
  }
}
