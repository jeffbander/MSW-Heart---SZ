import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireTestingAccess, isAuthError } from '@/lib/auth';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/echo-templates/from-week - Create template from existing week
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { name, description, weekStartDate } = body;

    if (!name || !weekStartDate) {
      return NextResponse.json(
        { error: 'Template name and week start date are required' },
        { status: 400 }
      );
    }

    // Calculate week date range (Monday to Sunday)
    const startDate = new Date(weekStartDate + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const startDateStr = formatLocalDate(startDate);
    const endDateStr = formatLocalDate(endDate);

    // Fetch existing assignments for the week
    const { data: assignments, error: fetchError } = await supabase
      .from('echo_schedule_assignments')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (fetchError) throw fetchError;

    // Create the template
    const { data: template, error: templateError } = await supabase
      .from('echo_schedule_templates')
      .insert({
        name,
        description: description || null
      })
      .select()
      .single();

    if (templateError) throw templateError;

    // Convert assignments to template assignments (date -> day_of_week)
    if (assignments && assignments.length > 0) {
      const templateAssignments = assignments.map(a => {
        const date = new Date(a.date + 'T00:00:00');
        const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

        return {
          template_id: template.id,
          day_of_week: dayOfWeek,
          echo_room_id: a.echo_room_id,
          echo_tech_id: a.echo_tech_id,
          time_block: a.time_block,
          notes: a.notes
        };
      });

      // Remove duplicates (same day_of_week, room, tech, time_block)
      const uniqueAssignments = templateAssignments.filter((a, index, self) =>
        index === self.findIndex(t =>
          t.day_of_week === a.day_of_week &&
          t.echo_room_id === a.echo_room_id &&
          t.echo_tech_id === a.echo_tech_id &&
          t.time_block === a.time_block
        )
      );

      const { error: assignmentError } = await supabase
        .from('echo_template_assignments')
        .insert(uniqueAssignments);

      if (assignmentError) throw assignmentError;
    }

    // Return template with assignments
    const { data: fullTemplate, error: fullError } = await supabase
      .from('echo_schedule_templates')
      .select('*')
      .eq('id', template.id)
      .single();

    if (fullError) throw fullError;

    const { data: templateAssignments } = await supabase
      .from('echo_template_assignments')
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `)
      .eq('template_id', template.id);

    return NextResponse.json({
      ...fullTemplate,
      assignments: templateAssignments || []
    });
  } catch (error) {
    console.error('Error creating template from week:', error);
    return NextResponse.json(
      { error: 'Failed to create template from week' },
      { status: 500 }
    );
  }
}
