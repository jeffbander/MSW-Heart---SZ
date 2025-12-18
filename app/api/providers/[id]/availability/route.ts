import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch availability rules for a provider
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('provider_availability_rules')
      .select('*, service:services(*)')
      .eq('provider_id', id)
      .order('service_id')
      .order('day_of_week');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching availability rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability rules' },
      { status: 500 }
    );
  }
}

// POST - Create a new availability rule
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { service_id, day_of_week, time_block, rule_type, enforcement, reason } = body;

    if (!service_id || day_of_week === undefined || !time_block) {
      return NextResponse.json(
        { error: 'service_id, day_of_week, and time_block are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('provider_availability_rules')
      .insert({
        provider_id: id,
        service_id,
        day_of_week,
        time_block,
        rule_type: rule_type || 'allow',
        enforcement: enforcement || 'hard',
        reason
      })
      .select('*, service:services(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A rule for this day/time already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating availability rule:', error);
    return NextResponse.json(
      { error: 'Failed to create availability rule' },
      { status: 500 }
    );
  }
}

// PUT - Update availability rules (bulk update for a service)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { rules, service_id } = body;

    if (!service_id || !Array.isArray(rules)) {
      return NextResponse.json(
        { error: 'service_id and rules array are required' },
        { status: 400 }
      );
    }

    // Delete existing rules for this provider/service combo
    const { error: deleteError } = await supabase
      .from('provider_availability_rules')
      .delete()
      .eq('provider_id', id)
      .eq('service_id', service_id);

    if (deleteError) throw deleteError;

    // Insert new rules if any
    if (rules.length > 0) {
      const rulesToInsert = rules.map((rule: {
        day_of_week: number;
        time_block: string;
        rule_type?: string;
        enforcement?: string;
        reason?: string;
      }) => ({
        provider_id: id,
        service_id,
        day_of_week: rule.day_of_week,
        time_block: rule.time_block,
        rule_type: rule.rule_type || 'allow',
        enforcement: rule.enforcement || 'hard',
        reason: rule.reason
      }));

      const { error: insertError } = await supabase
        .from('provider_availability_rules')
        .insert(rulesToInsert);

      if (insertError) throw insertError;
    }

    // Fetch updated rules
    const { data, error: fetchError } = await supabase
      .from('provider_availability_rules')
      .select('*, service:services(*)')
      .eq('provider_id', id)
      .eq('service_id', service_id);

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, rules: data });
  } catch (error) {
    console.error('Error updating availability rules:', error);
    return NextResponse.json(
      { error: 'Failed to update availability rules' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific availability rule
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'ruleId is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('provider_availability_rules')
      .delete()
      .eq('id', ruleId)
      .eq('provider_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete availability rule' },
      { status: 500 }
    );
  }
}
