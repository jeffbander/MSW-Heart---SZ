import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to get week start (Sunday) for a date
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - dayOfWeek);
  return date.toISOString().split('T')[0];
}

// Helper to get week end (Saturday) for a date
function getWeekEnd(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() + (6 - dayOfWeek));
  return date.toISOString().split('T')[0];
}

// POST - Create template from existing week's assignments
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, type, weekStartDate, isGlobal, ownerId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    if (!weekStartDate) {
      return NextResponse.json(
        { error: 'Week start date is required' },
        { status: 400 }
      );
    }

    // Calculate the week range
    const weekStart = getWeekStart(weekStartDate);
    const weekEnd = getWeekEnd(weekStart);

    // Fetch all assignments for the week
    const { data: weekAssignments, error: fetchError } = await supabase
      .from('schedule_assignments')
      .select('*')
      .gte('date', weekStart)
      .lte('date', weekEnd);

    if (fetchError) throw fetchError;

    if (!weekAssignments || weekAssignments.length === 0) {
      return NextResponse.json(
        { error: 'No assignments found for this week' },
        { status: 400 }
      );
    }

    // Create the template
    const { data: template, error: templateError } = await supabase
      .from('schedule_templates')
      .insert({
        name,
        description: description || `Created from week of ${weekStart}`,
        type: type || 'weekly',
        is_global: isGlobal !== false,
        owner_id: ownerId || null,
      })
      .select()
      .single();

    if (templateError) throw templateError;

    // Convert assignments to template assignments (date -> day_of_week)
    const templateAssignments = weekAssignments.map((a) => {
      const date = new Date(a.date + 'T00:00:00');
      const dayOfWeek = date.getDay();

      return {
        template_id: template.id,
        day_of_week: dayOfWeek,
        service_id: a.service_id,
        provider_id: a.provider_id,
        time_block: a.time_block,
        room_count: a.room_count,
        is_pto: a.is_pto,
        notes: a.notes,
      };
    });

    // Insert template assignments
    const { data: createdAssignments, error: assignmentsError } = await supabase
      .from('template_assignments')
      .insert(templateAssignments)
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `);

    if (assignmentsError) throw assignmentsError;

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        assignments: createdAssignments,
      },
      sourceWeek: {
        start: weekStart,
        end: weekEnd,
        assignmentCount: weekAssignments.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template from week:', error);
    return NextResponse.json(
      { error: 'Failed to create template from week' },
      { status: 500 }
    );
  }
}
