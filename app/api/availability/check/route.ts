import { NextResponse } from 'next/server';
import { checkProviderAvailability, checkBulkAvailability } from '@/lib/availability';

// POST - Check availability for one or more assignments
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Single check
    if (body.provider_id && body.service_id && body.date && body.time_block) {
      const result = await checkProviderAvailability(
        body.provider_id,
        body.service_id,
        body.date,
        body.time_block
      );
      return NextResponse.json(result);
    }

    // Bulk check
    if (Array.isArray(body.assignments)) {
      const result = await checkBulkAvailability(body.assignments);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid request format. Provide either single assignment fields or assignments array.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
