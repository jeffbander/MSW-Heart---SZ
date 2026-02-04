import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/pto-requests - List all PTO requests with optional filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const providerId = searchParams.get('providerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('pto_requests')
      .select(`
        *,
        provider:providers(id, name, initials, role)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }
    if (startDate) {
      query = query.gte('end_date', startDate);
    }
    if (endDate) {
      query = query.lte('start_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching PTO requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PTO requests' },
      { status: 500 }
    );
  }
}

// POST /api/pto-requests - Create a new PTO request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      provider_id,
      start_date,
      end_date,
      leave_type,
      time_block,
      reason,
      requested_by
    } = body;

    // Validate required fields
    if (!provider_id || !start_date || !end_date || !leave_type || !time_block || !requested_by) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(start_date + 'T00:00:00') > new Date(end_date + 'T00:00:00')) {
      return NextResponse.json(
        { error: 'Start date must be before or equal to end date' },
        { status: 400 }
      );
    }

    // If admin is submitting, auto-approve and create provider_leave
    const isAdminSubmission = requested_by === 'admin';
    const initialStatus = isAdminSubmission ? 'approved' : 'pending';

    const { data, error } = await supabase
      .from('pto_requests')
      .insert({
        provider_id,
        start_date,
        end_date,
        leave_type,
        time_block,
        reason,
        requested_by,
        status: initialStatus,
        reviewed_at: isAdminSubmission ? new Date().toISOString() : null,
        reviewed_by_admin_name: isAdminSubmission ? 'Auto-approved (admin entry)' : null
      })
      .select(`
        *,
        provider:providers(id, name, initials, role)
      `)
      .single();

    if (error) throw error;

    // If admin-submitted (auto-approved), also create provider_leave entry
    if (isAdminSubmission) {
      const { error: leaveError } = await supabase
        .from('provider_leaves')
        .insert({
          provider_id,
          start_date,
          end_date,
          leave_type,
          reason
        });

      if (leaveError) {
        console.error('Error creating provider_leave:', leaveError);
        // Don't fail the request, the PTO request was created successfully
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating PTO request:', error);
    return NextResponse.json(
      { error: 'Failed to create PTO request' },
      { status: 500 }
    );
  }
}
