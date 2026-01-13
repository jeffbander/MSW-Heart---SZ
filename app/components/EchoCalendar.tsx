'use client';

import { useMemo } from 'react';
import { EchoTech, EchoRoom, EchoScheduleAssignment, EchoPTO, EchoConflict } from '@/lib/types';

interface EchoCalendarProps {
  dateRange: string[];
  echoTechs: EchoTech[];
  echoRooms: EchoRoom[];
  assignments: EchoScheduleAssignment[];
  ptoDays: EchoPTO[];
  isAdmin: boolean;
  onCellClick: (roomId: string, date: string, timeBlock: 'AM' | 'PM') => void;
  onPTOClick: (date: string, timeBlock: 'AM' | 'PM') => void;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
  warningRed: '#DC2626',
  warningAmber: '#F59E0B',
  lightGray: '#F5F5F5',
  categoryBg: '#F3F4F6',
};

export default function EchoCalendar({
  dateRange,
  echoTechs,
  echoRooms,
  assignments,
  ptoDays,
  isAdmin,
  onCellClick,
  onPTOClick
}: EchoCalendarProps) {

  // Group rooms by category
  const roomsByCategory = useMemo(() => {
    const grouped: Record<string, EchoRoom[]> = {};
    echoRooms.forEach(room => {
      if (!grouped[room.category]) {
        grouped[room.category] = [];
      }
      grouped[room.category].push(room);
    });
    return grouped;
  }, [echoRooms]);

  // Create lookup maps
  const techMap = useMemo(() => {
    const map = new Map<string, EchoTech>();
    echoTechs.forEach(tech => map.set(tech.id, tech));
    return map;
  }, [echoTechs]);

  const roomMap = useMemo(() => {
    const map = new Map<string, EchoRoom>();
    echoRooms.forEach(room => map.set(room.id, room));
    return map;
  }, [echoRooms]);

  // Get assignments for a specific cell
  const getAssignments = (roomId: string, date: string, timeBlock: 'AM' | 'PM') => {
    return assignments.filter(
      a => a.echo_room_id === roomId && a.date === date && a.time_block === timeBlock
    );
  };

  // Get PTO for a specific date/timeblock
  const getPTO = (date: string, timeBlock: 'AM' | 'PM') => {
    return ptoDays.filter(
      p => p.date === date && (p.time_block === timeBlock || p.time_block === 'BOTH')
    );
  };

  // Check for conflicts
  const getConflicts = useMemo(() => {
    const conflicts: EchoConflict[] = [];

    dateRange.forEach(date => {
      ['AM', 'PM'].forEach(timeBlock => {
        const tb = timeBlock as 'AM' | 'PM';
        const ptoTechs = new Set(getPTO(date, tb).map(p => p.echo_tech_id));

        // Check each tech for double-booking
        const techAssignments = new Map<string, string[]>();

        echoRooms.forEach(room => {
          const roomAssignments = getAssignments(room.id, date, tb);
          roomAssignments.forEach(assignment => {
            const techId = assignment.echo_tech_id;
            if (!techAssignments.has(techId)) {
              techAssignments.set(techId, []);
            }
            techAssignments.get(techId)!.push(room.id);

            // Check if tech is on PTO
            if (ptoTechs.has(techId)) {
              const tech = techMap.get(techId);
              conflicts.push({
                type: 'pto_conflict',
                date,
                time_block: tb,
                echo_tech_id: techId,
                echo_room_id: room.id,
                message: `${tech?.name || 'Tech'} is on PTO but assigned to ${room.short_name || room.name}`
              });
            }
          });
        });

        // Check for double bookings
        techAssignments.forEach((roomIds, techId) => {
          if (roomIds.length > 1) {
            const tech = techMap.get(techId);
            conflicts.push({
              type: 'double_booked',
              date,
              time_block: tb,
              echo_tech_id: techId,
              message: `${tech?.name || 'Tech'} is assigned to ${roomIds.length} rooms`
            });
          }
        });
      });
    });

    return conflicts;
  }, [dateRange, assignments, ptoDays, echoRooms, techMap]);

  // Check if a cell has a conflict
  const hasConflict = (techId: string, date: string, timeBlock: 'AM' | 'PM') => {
    return getConflicts.some(
      c => c.echo_tech_id === techId && c.date === date && c.time_block === timeBlock
    );
  };

  // Calculate capacity for a date/timeblock (CVI rooms only)
  const calculateCapacity = (date: string, timeBlock: 'AM' | 'PM', capacityType: string) => {
    let total = 0;
    const countedTechs = new Set<string>();

    echoRooms
      .filter(room => room.capacity_type === capacityType && room.category === 'CVI')
      .forEach(room => {
        const roomAssignments = getAssignments(room.id, date, timeBlock);
        roomAssignments.forEach(assignment => {
          if (!countedTechs.has(assignment.echo_tech_id)) {
            const tech = techMap.get(assignment.echo_tech_id);
            if (tech) {
              total += tech.capacity_per_half_day;
              countedTechs.add(assignment.echo_tech_id);
            }
          }
        });
      });

    return total;
  };

  // Format date for header
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${days[date.getDay()]} ${month}/${day}`;
  };

  // Check if date is weekend
  const isWeekend = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDay() === 0 || date.getDay() === 6;
  };

  // Render tech names for a cell
  const renderCellContent = (roomId: string, date: string, timeBlock: 'AM' | 'PM') => {
    const cellAssignments = getAssignments(roomId, date, timeBlock);

    if (cellAssignments.length === 0) {
      const weekend = isWeekend(date);
      return (
        <span className={weekend ? 'text-gray-300' : 'text-amber-400'}>
          {weekend ? '-' : '--'}
        </span>
      );
    }

    return cellAssignments.map((assignment, idx) => {
      const tech = techMap.get(assignment.echo_tech_id);
      const conflict = hasConflict(assignment.echo_tech_id, date, timeBlock);

      return (
        <span
          key={assignment.id}
          className={conflict ? 'text-red-600 font-medium' : ''}
          title={conflict ? 'Conflict detected' : (assignment.notes || tech?.name)}
        >
          {idx > 0 && ', '}
          {conflict && '⚠️ '}
          {tech?.name || 'Unknown'}
          {assignment.notes && <span className="text-gray-500 text-xs ml-1">{assignment.notes}</span>}
        </span>
      );
    });
  };

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-30">
          <tr>
            <th
              className="sticky left-0 z-40 border p-2 text-left font-medium"
              style={{ backgroundColor: colors.primaryBlue, color: 'white', minWidth: '180px' }}
            >
              Location
            </th>
            {dateRange.map(date => (
              <th
                key={date}
                colSpan={2}
                className={`border p-2 text-center font-medium ${isWeekend(date) ? 'bg-gray-200' : ''}`}
                style={{
                  backgroundColor: isWeekend(date) ? '#E5E7EB' : colors.primaryBlue,
                  color: isWeekend(date) ? '#6B7280' : 'white',
                  minWidth: '120px'
                }}
              >
                {formatDateHeader(date)}
              </th>
            ))}
          </tr>
          <tr>
            <th
              className="sticky left-0 z-40 border p-1 text-left text-xs"
              style={{ backgroundColor: colors.lightGray }}
            >
            </th>
            {dateRange.map(date => (
              <>
                <th
                  key={`${date}-AM`}
                  className="border p-1 text-center text-xs"
                  style={{ backgroundColor: colors.lightGray }}
                >
                  AM
                </th>
                <th
                  key={`${date}-PM`}
                  className="border p-1 text-center text-xs"
                  style={{ backgroundColor: colors.lightGray }}
                >
                  PM
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* PTO Row */}
          <tr className="bg-red-50">
            <td className="sticky left-0 z-10 border p-2 font-medium bg-red-50" style={{ color: colors.warningRed }}>
              PTO
            </td>
            {dateRange.map(date => (
              <>
                <td
                  key={`${date}-AM-pto`}
                  className={`border p-1 text-xs ${isAdmin ? 'cursor-pointer hover:bg-red-100' : ''}`}
                  onClick={() => isAdmin && onPTOClick(date, 'AM')}
                >
                  {getPTO(date, 'AM').map((p, idx) => {
                    const tech = techMap.get(p.echo_tech_id);
                    return (
                      <span key={p.id}>
                        {idx > 0 && ', '}
                        {tech?.name}
                        {p.reason && <span className="text-gray-500"> ({p.reason})</span>}
                      </span>
                    );
                  })}
                </td>
                <td
                  key={`${date}-PM-pto`}
                  className={`border p-1 text-xs ${isAdmin ? 'cursor-pointer hover:bg-red-100' : ''}`}
                  onClick={() => isAdmin && onPTOClick(date, 'PM')}
                >
                  {getPTO(date, 'PM').map((p, idx) => {
                    const tech = techMap.get(p.echo_tech_id);
                    return (
                      <span key={p.id}>
                        {idx > 0 && ', '}
                        {tech?.name}
                        {p.reason && <span className="text-gray-500"> ({p.reason})</span>}
                      </span>
                    );
                  })}
                </td>
              </>
            ))}
          </tr>

          {/* Capacity Section Header */}
          <tr>
            <td
              colSpan={dateRange.length * 2 + 1}
              className="border p-2 font-bold"
              style={{ backgroundColor: colors.categoryBg, color: colors.primaryBlue }}
            >
              CAPACITY
            </td>
          </tr>

          {/* Capacity Rows */}
          {['vascular', 'echo', 'stress_echo'].map(capacityType => (
            <tr key={capacityType} className="bg-blue-50">
              <td className="sticky left-0 z-10 border p-2 pl-6 text-sm bg-blue-50">
                {capacityType === 'vascular' ? 'Vascular' :
                 capacityType === 'echo' ? 'Echo' : 'Stress Echo'}
              </td>
              {dateRange.map(date => (
                <>
                  <td key={`${date}-AM-${capacityType}`} className="border p-1 text-center text-sm font-medium">
                    {calculateCapacity(date, 'AM', capacityType)}
                  </td>
                  <td key={`${date}-PM-${capacityType}`} className="border p-1 text-center text-sm font-medium">
                    {calculateCapacity(date, 'PM', capacityType)}
                  </td>
                </>
              ))}
            </tr>
          ))}

          {/* Room Sections by Category */}
          {Object.entries(roomsByCategory).map(([category, rooms]) => (
            <>
              {/* Category Header */}
              <tr key={`header-${category}`}>
                <td
                  colSpan={dateRange.length * 2 + 1}
                  className="border p-2 font-bold"
                  style={{ backgroundColor: colors.categoryBg, color: colors.primaryBlue }}
                >
                  {category.toUpperCase()}
                </td>
              </tr>

              {/* Room Rows */}
              {rooms.map(room => (
                <tr key={room.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white border p-2 pl-4">
                    <div className="font-medium text-sm">{room.short_name || room.name}</div>
                    {room.short_name && (
                      <div className="text-xs text-gray-500">{room.name}</div>
                    )}
                  </td>
                  {dateRange.map(date => (
                    <>
                      <td
                        key={`${room.id}-${date}-AM`}
                        className={`border p-1 text-xs ${isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''} ${isWeekend(date) ? 'bg-gray-50' : ''}`}
                        onClick={() => isAdmin && onCellClick(room.id, date, 'AM')}
                      >
                        {renderCellContent(room.id, date, 'AM')}
                      </td>
                      <td
                        key={`${room.id}-${date}-PM`}
                        className={`border p-1 text-xs ${isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''} ${isWeekend(date) ? 'bg-gray-50' : ''}`}
                        onClick={() => isAdmin && onCellClick(room.id, date, 'PM')}
                      >
                        {renderCellContent(room.id, date, 'PM')}
                      </td>
                    </>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
