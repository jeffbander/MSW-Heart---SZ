import { NextResponse } from 'next/server';
import { sendPTOSubmissionEmail } from '@/lib/email';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider_id, start_date, end_date, leave_type, time_block } = body;

    if (!provider_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get provider details
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('name, initials')
      .eq('id', provider_id)
      .single();

    if (providerError || !provider) {
      console.error('Failed to get provider:', providerError);
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Send email notification
    const emailSent = await sendPTOSubmissionEmail({
      providerName: `${provider.initials} - ${provider.name}`,
      startDate: start_date,
      endDate: end_date,
      leaveType: leave_type || 'vacation',
      timeBlock: time_block || 'FULL',
    });

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent ? 'Notification sent' : 'Email not configured',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
