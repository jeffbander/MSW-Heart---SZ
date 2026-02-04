import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPTOApprovalEmail } from '@/lib/email';

// POST /api/pto-requests/[id]/approve - Approve a PTO request
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

    // First get the request details
    const { data: request_data, error: fetchError } = await supabase
      .from('pto_requests')
      .select('*')
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
    if (request_data.status !== 'pending') {
      return NextResponse.json(
        { error: `Request has already been ${request_data.status}` },
        { status: 400 }
      );
    }

    // Update the request status to approved
    const { data, error } = await supabase
      .from('pto_requests')
      .update({
        status: 'approved',
        reviewed_by_admin_name: admin_name,
        reviewed_at: new Date().toISOString(),
        admin_comment: admin_comment || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        provider:providers(id, name, initials, role)
      `)
      .single();

    if (error) throw error;

    // Create provider_leave entry for the approved request
    const { error: leaveError } = await supabase
      .from('provider_leaves')
      .insert({
        provider_id: request_data.provider_id,
        start_date: request_data.start_date,
        end_date: request_data.end_date,
        leave_type: request_data.leave_type,
        reason: request_data.reason
      });

    if (leaveError) {
      console.error('Error creating provider_leave:', leaveError);
      // Don't fail - the approval was successful, we'll log the error
    }

    // Send email notification to provider
    try {
      await sendPTOApprovalEmail({
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
      console.error('Failed to send approval email:', emailError);
      // Don't fail - the approval was successful
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error approving PTO request:', error);
    return NextResponse.json(
      { error: 'Failed to approve PTO request' },
      { status: 500 }
    );
  }
}
