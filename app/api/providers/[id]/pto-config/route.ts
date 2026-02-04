import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PUT /api/providers/[id]/pto-config - Update PTO configuration for a provider
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { year, annual_allowance, carryover_days, notes } = body;

    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      );
    }

    // Verify provider exists
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id')
      .eq('id', id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Upsert the PTO configuration
    const { data, error } = await supabase
      .from('provider_pto_config')
      .upsert(
        {
          provider_id: id,
          year,
          annual_allowance: annual_allowance !== null && annual_allowance !== undefined ? annual_allowance : null,
          carryover_days: carryover_days || 0,
          notes: notes || null,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'provider_id,year',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (error) {
      // If table doesn't exist, return a helpful message
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'PTO configuration tables not set up. Please run the pto-balance-setup.sql script.' },
          { status: 500 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      config: data
    });
  } catch (error) {
    console.error('Error updating PTO config:', error);
    return NextResponse.json(
      { error: 'Failed to update PTO configuration' },
      { status: 500 }
    );
  }
}

// GET /api/providers/[id]/pto-config - Get PTO configuration for a provider
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    const { data, error } = await supabase
      .from('provider_pto_config')
      .select('*')
      .eq('provider_id', id)
      .eq('year', year)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config found, return null (will use defaults)
        return NextResponse.json({ config: null });
      }
      throw error;
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('Error fetching PTO config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PTO configuration' },
      { status: 500 }
    );
  }
}
