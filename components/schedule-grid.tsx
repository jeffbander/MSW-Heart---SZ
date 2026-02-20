"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Fragment } from "react"
import { ChevronDown, ChevronRight, AlertTriangle, ChevronLast, ChevronFirst, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EchoTech, EchoRoom, EchoScheduleAssignment, EchoPTO, Holiday } from "@/lib/types"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ============================================
// TYPES
// ============================================

interface WeekDate {
  date: string
  dayName: string
  fullDate: string
  isWeekend: boolean
  holiday?: Holiday
}

interface StaffEntry {
  name: string
  assignmentId: string
}

interface TimeSlot {
  am: string[]
  pm: string[]
  amEntries: StaffEntry[]
  pmEntries: StaffEntry[]
}

interface RoomSchedule {
  id: string
  name: string
  location: string
  slots: Record<string, TimeSlot>
}

interface LabSection {
  name: string
  roomCount: number
  rooms: RoomSchedule[]
  isExpanded: boolean
}

interface DayCapacity {
  date: string
  dayName: string
  echo: number
  stressEcho: number
  vascular: number
}

interface CellId {
  roomId: string
  date: string
  timeBlock: 'AM' | 'PM'
}

// ============================================
// PROPS INTERFACE
// ============================================

interface ScheduleGridProps {
  dateRange: string[]
  echoTechs: EchoTech[]
  echoRooms: EchoRoom[]
  assignments: EchoScheduleAssignment[]
  ptoDays: EchoPTO[]
  holidays?: Holiday[]
  isAdmin?: boolean
  onCellClick?: (roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
  onPTOClick?: (date: string, timeBlock: 'AM' | 'PM') => void
  onQuickDelete?: (assignmentId: string) => void
  onQuickAssign?: (roomId: string, date: string, timeBlock: 'AM' | 'PM', techId: string) => void
  onBulkAssign?: (cells: CellId[], techId: string) => void
  onMoveAssignment?: (assignmentId: string, newRoomId: string, newDate: string, newTimeBlock: 'AM' | 'PM') => void
  collapsedCategories?: Set<string>
  onToggleCategory?: (category: string) => void
  onRoomReorder?: (category: string, roomIds: string[]) => void
}

// ============================================
// HELPERS
// ============================================

function cellKey(roomId: string, date: string, timeBlock: string) {
  return `${roomId}-${date}-${timeBlock}`
}

function parseCellKey(key: string): CellId | null {
  const parts = key.split('-')
  if (parts.length < 4) return null
  // UUID has 5 parts with dashes, date has 3 parts
  // format: uuid-YYYY-MM-DD-AM/PM
  const timeBlock = parts[parts.length - 1] as 'AM' | 'PM'
  const date = `${parts[parts.length - 4]}-${parts[parts.length - 3]}-${parts[parts.length - 2]}`
  const roomId = parts.slice(0, parts.length - 4).join('-')
  return { roomId, date, timeBlock }
}

// ============================================
// DATA TRANSFORMATION FUNCTIONS
// ============================================

function transformDates(dateRange: string[], holidays: Holiday[] = []): WeekDate[] {
  const holidayMap = new Map(holidays.map(h => [h.date, h]))

  return dateRange.map(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayOfWeek = date.getDay()

    return {
      date: `${month}/${day}`,
      dayName: days[dayOfWeek],
      fullDate: dateStr,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      holiday: holidayMap.get(dateStr)
    }
  })
}

function transformRooms(
  echoRooms: EchoRoom[],
  dateRange: string[],
  assignments: EchoScheduleAssignment[],
  echoTechs: EchoTech[]
): LabSection[] {
  const techMap = new Map(echoTechs.map(t => [t.id, t]))

  const roomsByCategory: Record<string, EchoRoom[]> = {}
  echoRooms.forEach(room => {
    if (!roomsByCategory[room.category]) {
      roomsByCategory[room.category] = []
    }
    roomsByCategory[room.category].push(room)
  })

  const sections: LabSection[] = []
  const categoryOrder = ['CVI', 'Fourth Floor Lab']
  const sortedCategories = Object.keys(roomsByCategory).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a)
    const indexB = categoryOrder.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  sortedCategories.forEach((category) => {
    const rooms = roomsByCategory[category]
    const roomSchedules: RoomSchedule[] = rooms.map(room => {
      const slots: Record<string, TimeSlot> = {}

      dateRange.forEach(dateStr => {
        const date = new Date(dateStr + 'T00:00:00')
        const month = date.getMonth() + 1
        const day = date.getDate()
        const displayDate = `${month}/${day}`

        const amAssignments = assignments.filter(
          a => a.echo_room_id === room.id && a.date === dateStr && a.time_block === 'AM'
        )
        const pmAssignments = assignments.filter(
          a => a.echo_room_id === room.id && a.date === dateStr && a.time_block === 'PM'
        )

        slots[displayDate] = {
          am: amAssignments.map(a => techMap.get(a.echo_tech_id)?.name || 'Unknown'),
          pm: pmAssignments.map(a => techMap.get(a.echo_tech_id)?.name || 'Unknown'),
          amEntries: amAssignments.map(a => ({ name: techMap.get(a.echo_tech_id)?.name || 'Unknown', assignmentId: a.id })),
          pmEntries: pmAssignments.map(a => ({ name: techMap.get(a.echo_tech_id)?.name || 'Unknown', assignmentId: a.id })),
        }
      })

      return {
        id: room.id,
        name: room.short_name || room.name,
        location: room.name,
        slots
      }
    })

    sections.push({
      name: category,
      roomCount: rooms.length,
      rooms: roomSchedules,
      isExpanded: category !== 'Fourth Floor Lab'
    })
  })

  return sections
}

interface PTOEntry {
  name: string
  timeBlock: 'AM' | 'PM' | 'BOTH'
}

function transformPTO(
  ptoDays: EchoPTO[],
  echoTechs: EchoTech[],
  dateRange: string[]
): Record<string, PTOEntry[]> {
  const techMap = new Map(echoTechs.map(t => [t.id, t]))
  const ptoData: Record<string, PTOEntry[]> = {}

  dateRange.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const month = date.getMonth() + 1
    const day = date.getDate()
    const displayDate = `${month}/${day}`

    const dayPTO = ptoDays.filter(p => p.date === dateStr)
    const entries: PTOEntry[] = dayPTO.map(p => ({
      name: techMap.get(p.echo_tech_id)?.name || 'Unknown',
      timeBlock: (p.time_block as 'AM' | 'PM' | 'BOTH') || 'BOTH',
    }))

    ptoData[displayDate] = entries
  })

  return ptoData
}

function transformCapacity(
  dateRange: string[],
  assignments: EchoScheduleAssignment[],
  echoTechs: EchoTech[],
  echoRooms: EchoRoom[]
): DayCapacity[] {
  const techMap = new Map(echoTechs.map(t => [t.id, t]))

  return dateRange
    .filter(dateStr => {
      const date = new Date(dateStr + 'T00:00:00')
      const dayOfWeek = date.getDay()
      return dayOfWeek !== 0 && dayOfWeek !== 6
    })
    .map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00')
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const month = date.getMonth() + 1

      const calculateCapacity = (capacityType: string) => {
        let total = 0
        const countedTechs = new Set<string>()
        const relevantRooms = echoRooms.filter(
          room => room.capacity_type === capacityType && room.category === 'CVI'
        )

        ;['AM', 'PM'].forEach(timeBlock => {
          relevantRooms.forEach(room => {
            const roomAssignments = assignments.filter(
              a => a.echo_room_id === room.id && a.date === dateStr && a.time_block === timeBlock
            )
            roomAssignments.forEach(assignment => {
              const key = `${timeBlock}-${assignment.echo_tech_id}`
              if (!countedTechs.has(key)) {
                const tech = techMap.get(assignment.echo_tech_id)
                if (tech) {
                  total += tech.capacity_per_half_day
                  countedTechs.add(key)
                }
              }
            })
          })
        })

        return total
      }

      return {
        date: `${month}/${date.getDate()}`,
        dayName: days[date.getDay()],
        echo: calculateCapacity('echo'),
        stressEcho: calculateCapacity('stress_echo'),
        vascular: calculateCapacity('vascular')
      }
    })
}

// ============================================
// INLINE TECH DROPDOWN (Feature 7)
// ============================================

function InlineTechDropdown({
  echoTechs,
  assignedTechIds,
  onSelect,
  onClose,
}: {
  echoTechs: EchoTech[]
  assignedTechIds: Set<string>
  onSelect: (techId: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const available = echoTechs.filter(t => t.is_active && !assignedTechIds.has(t.id))
  const filtered = search
    ? available.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : available

  return (
    <div
      ref={ref}
      className="absolute z-50 top-0 left-0 w-44 bg-white border border-slate-300 rounded-lg shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search..."
        className="w-full px-2 py-1.5 text-xs border-b border-slate-200 rounded-t-lg outline-none"
      />
      <div className="max-h-36 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map(tech => (
            <button
              key={tech.id}
              onClick={() => onSelect(tech.id)}
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-blue-50 flex justify-between items-center"
            >
              <span className="truncate">{tech.name}</span>
              <span className="text-gray-400 text-[10px] ml-1 flex-shrink-0">cap:{tech.capacity_per_half_day}</span>
            </button>
          ))
        ) : (
          <div className="px-2 py-1.5 text-xs text-gray-400">No techs found</div>
        )}
      </div>
    </div>
  )
}

// ============================================
// DRAGGABLE TECH NAME (Feature 9)
// ============================================

function DraggableTechName({
  entry,
  isConflict,
  isAdmin,
  onQuickDelete,
  isDragEnabled,
}: {
  entry: StaffEntry
  isConflict: boolean
  isAdmin: boolean
  onQuickDelete?: (assignmentId: string) => void
  isDragEnabled: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assign-${entry.assignmentId}`,
    data: { type: 'assignment', assignmentId: entry.assignmentId, name: entry.name },
    disabled: !isDragEnabled,
  })

  return (
    <span
      ref={setNodeRef}
      {...(isDragEnabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        "text-[13px] leading-tight group/staff inline-flex items-center gap-0.5",
        isConflict ? "text-amber-600 font-semibold" : "text-slate-700",
        isDragging && "opacity-30",
        isDragEnabled && "cursor-grab active:cursor-grabbing touch-none"
      )}
    >
      {isConflict && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
      {entry.name}
      {isAdmin && onQuickDelete && entry.assignmentId && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onQuickDelete(entry.assignmentId)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover/staff:opacity-100 ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center hover:bg-red-600 transition-opacity"
          title="Remove assignment"
        >
          &times;
        </button>
      )}
    </span>
  )
}

// ============================================
// DROPPABLE CELL WRAPPER (Feature 9)
// ============================================

function DroppableCell({
  id,
  children,
  className,
  onClick,
  isSelected,
  isFocused,
  tabIndex,
  onKeyDown,
}: {
  id: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
  isSelected?: boolean
  isFocused?: boolean
  tabIndex?: number
  onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${id}`,
    data: { type: 'cell', cellKey: id },
  })

  return (
    <td
      ref={setNodeRef}
      className={cn(
        className,
        isOver && "bg-blue-200/60 ring-2 ring-blue-400 ring-inset",
        isSelected && "ring-2 ring-blue-500 ring-inset bg-blue-50/60",
        isFocused && "ring-2 ring-[#003D7A] ring-inset",
      )}
      onClick={onClick}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      {children}
    </td>
  )
}

// ============================================
// STAFF CELL
// ============================================

function StaffCell({
  staff,
  entries,
  ptoStaff,
  isWeekend = false,
  isBlockedHoliday = false,
  isAdmin = false,
  onQuickDelete,
  isDragEnabled = false,
}: {
  staff: string[]
  entries?: StaffEntry[]
  ptoStaff: string[]
  isWeekend?: boolean
  isBlockedHoliday?: boolean
  isAdmin?: boolean
  onQuickDelete?: (assignmentId: string) => void
  isDragEnabled?: boolean
}) {
  if (isWeekend || isBlockedHoliday) {
    return <span className="text-slate-400">-</span>
  }

  if (staff.length === 0) {
    return <span className="text-amber-600 font-semibold">--</span>
  }

  const items = entries || staff.map(name => ({ name, assignmentId: '' }))

  return (
    <div className="flex flex-col items-center gap-0.5">
      {items.map((entry) => {
        const isConflict = ptoStaff.includes(entry.name)
        if (isDragEnabled && isAdmin && entry.assignmentId) {
          return (
            <DraggableTechName
              key={entry.assignmentId || entry.name}
              entry={entry}
              isConflict={isConflict}
              isAdmin={isAdmin}
              onQuickDelete={onQuickDelete}
              isDragEnabled={isDragEnabled}
            />
          )
        }
        return (
          <span
            key={entry.assignmentId || entry.name}
            className={cn(
              "text-[13px] leading-tight group/staff inline-flex items-center gap-0.5",
              isConflict ? "text-amber-600 font-semibold" : "text-slate-700"
            )}
          >
            {isConflict && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
            {entry.name}
            {isAdmin && onQuickDelete && entry.assignmentId && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickDelete(entry.assignmentId)
                }}
                className="opacity-0 group-hover/staff:opacity-100 ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center hover:bg-red-600 transition-opacity"
                title="Remove assignment"
              >
                &times;
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

// ============================================
// SORTABLE ROOM ROW
// ============================================

function SortableRoomRow({
  room,
  weekdayDates,
  weekendDates,
  showWeekend,
  isOdd,
  ptoData,
  isAdmin,
  onCellClick,
  onQuickDelete,
  inlineAssignCell,
  onSetInlineAssign,
  onQuickAssign,
  echoTechs,
  assignments,
  selectedCells,
  onShiftClick,
  focusedCellKey,
  onFocusCell,
  onKeyDown,
  isDragEnabled,
}: {
  room: RoomSchedule
  weekdayDates: WeekDate[]
  weekendDates: WeekDate[]
  showWeekend: boolean
  isOdd: boolean
  ptoData: Record<string, PTOEntry[]>
  isAdmin?: boolean
  onCellClick?: (roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
  onQuickDelete?: (assignmentId: string) => void
  inlineAssignCell: string | null
  onSetInlineAssign: (key: string | null) => void
  onQuickAssign?: (roomId: string, date: string, timeBlock: 'AM' | 'PM', techId: string) => void
  echoTechs: EchoTech[]
  assignments: EchoScheduleAssignment[]
  selectedCells: Set<string>
  onShiftClick: (key: string) => void
  focusedCellKey: string | null
  onFocusCell: (key: string) => void
  onKeyDown: (e: React.KeyboardEvent, roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
  isDragEnabled: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isRowDragging,
  } = useSortable({ id: room.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isRowDragging ? 0.5 : 1,
  }

  const bgColor = isOdd ? "bg-slate-50/50" : "bg-white"

  const handleCellClick = (roomId: string, fullDate: string, timeBlock: 'AM' | 'PM', isEmpty: boolean, e: React.MouseEvent) => {
    const key = cellKey(roomId, fullDate, timeBlock)
    if (e.shiftKey && isAdmin) {
      e.preventDefault()
      onShiftClick(key)
      return
    }
    if (isEmpty && isAdmin && onQuickAssign) {
      onSetInlineAssign(key)
    } else if (isAdmin) {
      onCellClick?.(roomId, fullDate, timeBlock)
    }
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn("border-b border-slate-200/80 hover:bg-blue-50/40 transition-colors", bgColor, isRowDragging && "bg-blue-100")}
    >
      <td className={cn("py-3 px-4 sticky left-0 z-10 border-r border-slate-200", bgColor)}>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-200 rounded touch-none"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <div>
            <div className="font-medium text-[13px] text-slate-800">{room.name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{room.location}</div>
          </div>
        </div>
      </td>
      {weekdayDates.map((day, dayIdx) => {
        const slot = room.slots[day.date]
        const amStaff = slot?.am || []
        const pmStaff = slot?.pm || []
        const amEntries = slot?.amEntries || []
        const pmEntries = slot?.pmEntries || []
        const ptoEntries = ptoData[day.date] || []
        const amPtoStaff = ptoEntries.filter(e => e.timeBlock === 'AM' || e.timeBlock === 'BOTH').map(e => e.name)
        const pmPtoStaff = ptoEntries.filter(e => e.timeBlock === 'PM' || e.timeBlock === 'BOTH').map(e => e.name)
        const isBlockedHoliday = day.holiday?.block_assignments ?? false

        const amKey = cellKey(room.id, day.fullDate, 'AM')
        const pmKey = cellKey(room.id, day.fullDate, 'PM')
        const amIsEmpty = amStaff.length === 0
        const pmIsEmpty = pmStaff.length === 0

        // Compute assigned tech IDs for inline dropdown
        const amAssignedIds = new Set(
          assignments.filter(a => a.echo_room_id === room.id && a.date === day.fullDate && a.time_block === 'AM').map(a => a.echo_tech_id)
        )
        const pmAssignedIds = new Set(
          assignments.filter(a => a.echo_room_id === room.id && a.date === day.fullDate && a.time_block === 'PM').map(a => a.echo_tech_id)
        )

        return (
          <Fragment key={day.date}>
            <DroppableCell
              id={amKey}
              className={cn(
                "py-2.5 px-2 text-center border-r border-slate-100 relative",
                isBlockedHoliday ? "bg-[#EDE9FE]" : bgColor,
                isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-blue-100/50"
              )}
              onClick={() => isAdmin && !isBlockedHoliday && handleCellClick(room.id, day.fullDate, 'AM', amIsEmpty, { shiftKey: false } as React.MouseEvent)}
              isSelected={selectedCells.has(amKey)}
              isFocused={focusedCellKey === amKey}
              tabIndex={isAdmin ? 0 : undefined}
              onKeyDown={(e) => onKeyDown(e, room.id, day.fullDate, 'AM')}
            >
              {/* Capture real click with shift detection */}
              <div
                className="absolute inset-0 z-[1]"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isAdmin || isBlockedHoliday) return
                  handleCellClick(room.id, day.fullDate, 'AM', amIsEmpty, e)
                }}
                onFocus={() => onFocusCell(amKey)}
              />
              <div className="relative z-[2] pointer-events-auto">
                <StaffCell staff={amStaff} entries={amEntries} ptoStaff={amPtoStaff} isBlockedHoliday={isBlockedHoliday} isAdmin={isAdmin} onQuickDelete={onQuickDelete} isDragEnabled={isDragEnabled} />
                {inlineAssignCell === amKey && (
                  <InlineTechDropdown
                    echoTechs={echoTechs}
                    assignedTechIds={amAssignedIds}
                    onSelect={(techId) => {
                      onQuickAssign?.(room.id, day.fullDate, 'AM', techId)
                      onSetInlineAssign(null)
                    }}
                    onClose={() => onSetInlineAssign(null)}
                  />
                )}
              </div>
            </DroppableCell>
            <DroppableCell
              id={pmKey}
              className={cn(
                "py-2.5 px-2 text-center relative",
                isBlockedHoliday ? "bg-[#EDE9FE]" : bgColor,
                dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : "",
                isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-blue-100/50"
              )}
              onClick={() => isAdmin && !isBlockedHoliday && handleCellClick(room.id, day.fullDate, 'PM', pmIsEmpty, { shiftKey: false } as React.MouseEvent)}
              isSelected={selectedCells.has(pmKey)}
              isFocused={focusedCellKey === pmKey}
              tabIndex={isAdmin ? 0 : undefined}
              onKeyDown={(e) => onKeyDown(e, room.id, day.fullDate, 'PM')}
            >
              <div
                className="absolute inset-0 z-[1]"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isAdmin || isBlockedHoliday) return
                  handleCellClick(room.id, day.fullDate, 'PM', pmIsEmpty, e)
                }}
                onFocus={() => onFocusCell(pmKey)}
              />
              <div className="relative z-[2] pointer-events-auto">
                <StaffCell staff={pmStaff} entries={pmEntries} ptoStaff={pmPtoStaff} isBlockedHoliday={isBlockedHoliday} isAdmin={isAdmin} onQuickDelete={onQuickDelete} isDragEnabled={isDragEnabled} />
                {inlineAssignCell === pmKey && (
                  <InlineTechDropdown
                    echoTechs={echoTechs}
                    assignedTechIds={pmAssignedIds}
                    onSelect={(techId) => {
                      onQuickAssign?.(room.id, day.fullDate, 'PM', techId)
                      onSetInlineAssign(null)
                    }}
                    onClose={() => onSetInlineAssign(null)}
                  />
                )}
              </div>
            </DroppableCell>
          </Fragment>
        )
      })}
      {showWeekend && weekendDates.map((day, idx) => (
        <Fragment key={day.date}>
          <td className="py-2.5 px-2 text-center bg-slate-100/60 border-r border-slate-200/60">
            <StaffCell staff={[]} ptoStaff={[]} isWeekend />
          </td>
          <td className={cn(
            "py-2.5 px-2 text-center bg-slate-100/60",
            idx < weekendDates.length - 1 ? "border-r border-slate-200" : ""
          )}>
            <StaffCell staff={[]} ptoStaff={[]} isWeekend />
          </td>
        </Fragment>
      ))}
    </tr>
  )
}

// ============================================
// LAB SECTION
// ============================================

function LabSectionComponent({
  section,
  weekdayDates,
  weekendDates,
  showWeekend,
  ptoData,
  isAdmin,
  onCellClick,
  onQuickDelete,
  isCollapsed,
  onToggle,
  onRoomReorder,
  inlineAssignCell,
  onSetInlineAssign,
  onQuickAssign,
  echoTechs,
  assignments,
  selectedCells,
  onShiftClick,
  focusedCellKey,
  onFocusCell,
  onKeyDown,
  isDragEnabled,
}: {
  section: LabSection
  weekdayDates: WeekDate[]
  weekendDates: WeekDate[]
  showWeekend: boolean
  ptoData: Record<string, PTOEntry[]>
  isAdmin?: boolean
  onCellClick?: (roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
  onQuickDelete?: (assignmentId: string) => void
  isCollapsed?: boolean
  onToggle?: () => void
  onRoomReorder?: (category: string, roomIds: string[]) => void
  inlineAssignCell: string | null
  onSetInlineAssign: (key: string | null) => void
  onQuickAssign?: (roomId: string, date: string, timeBlock: 'AM' | 'PM', techId: string) => void
  echoTechs: EchoTech[]
  assignments: EchoScheduleAssignment[]
  selectedCells: Set<string>
  onShiftClick: (key: string) => void
  focusedCellKey: string | null
  onFocusCell: (key: string) => void
  onKeyDown: (e: React.KeyboardEvent, roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
  isDragEnabled: boolean
}) {
  const [localExpanded, setLocalExpanded] = useState(section.isExpanded)
  const [rooms, setRooms] = useState(section.rooms)
  const isExpanded = isCollapsed !== undefined ? !isCollapsed : localExpanded
  const totalCols = 1 + (weekdayDates.length * 2) + (showWeekend ? weekendDates.length * 2 : 0)

  useMemo(() => {
    setRooms(section.rooms)
  }, [section.rooms])

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setLocalExpanded(!localExpanded)
    }
  }

  // Room reorder within section (handled locally, updates parent via callback)
  const handleSortEnd = (activeId: string, overId: string) => {
    setRooms((items) => {
      const oldIndex = items.findIndex((item) => item.id === activeId)
      const newIndex = items.findIndex((item) => item.id === overId)
      if (oldIndex === -1 || newIndex === -1) return items
      const newItems = arrayMove(items, oldIndex, newIndex)
      if (onRoomReorder) {
        onRoomReorder(section.name, newItems.map((r) => r.id))
      }
      return newItems
    })
  }

  const commonRowProps = {
    weekdayDates,
    weekendDates,
    showWeekend,
    ptoData,
    isAdmin,
    onCellClick,
    onQuickDelete,
    inlineAssignCell,
    onSetInlineAssign,
    onQuickAssign,
    echoTechs,
    assignments,
    selectedCells,
    onShiftClick,
    focusedCellKey,
    onFocusCell,
    onKeyDown,
    isDragEnabled,
  }

  return (
    <>
      <tr
        className="bg-gradient-to-r from-slate-100 to-slate-50 cursor-pointer hover:from-slate-200 hover:to-slate-100 transition-all border-b border-slate-200"
        onClick={handleToggle}
      >
        <td colSpan={totalCols} className="py-2.5 px-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#003366] flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-white" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <span className="font-semibold text-sm text-[#003366] uppercase tracking-wide">{section.name}</span>
            <span className="text-xs text-slate-500 font-medium">({section.roomCount} rooms)</span>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {rooms.map((room, idx) => (
            <SortableRoomRow
              key={room.id}
              room={room}
              isOdd={idx % 2 === 1}
              {...commonRowProps}
            />
          ))}
        </SortableContext>
      )}
    </>
  )
}

// ============================================
// PTO ROW
// ============================================

function PTORow({
  weekdayDates,
  weekendDates,
  showWeekend,
  ptoData,
  isAdmin,
  onPTOClick
}: {
  weekdayDates: WeekDate[]
  weekendDates: WeekDate[]
  showWeekend: boolean
  ptoData: Record<string, PTOEntry[]>
  isAdmin?: boolean
  onPTOClick?: (date: string, timeBlock: 'AM' | 'PM') => void
}) {
  return (
    <tr className="bg-amber-50/50 border-b border-slate-200">
      <td className="py-3 px-4 sticky left-0 bg-amber-50/50 z-10 border-r border-slate-200">
        <span className="font-semibold text-sm text-amber-700">PTO</span>
      </td>
      {weekdayDates.map((day, dayIdx) => {
        const entries = ptoData[day.date] || []
        const isBlockedHoliday = day.holiday?.block_assignments ?? false
        const amStaff = entries.filter(e => e.timeBlock === 'AM' || e.timeBlock === 'BOTH')
        const pmStaff = entries.filter(e => e.timeBlock === 'PM' || e.timeBlock === 'BOTH')
        return (
          <Fragment key={day.date}>
            <td
              className={cn(
                "py-3 px-2 text-center border-r border-slate-100",
                isBlockedHoliday ? "bg-[#EDE9FE]" : "",
                isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-amber-100/50"
              )}
              onClick={() => isAdmin && !isBlockedHoliday && onPTOClick?.(day.fullDate, 'AM')}
            >
              {isBlockedHoliday ? (
                <span className="text-slate-400">-</span>
              ) : amStaff.length > 0 ? (
                <div className="flex flex-wrap gap-x-1 justify-center text-[13px]">
                  {amStaff.map((entry, idx) => (
                    <span key={entry.name} className="text-amber-700">
                      {entry.name}
                      {idx < amStaff.length - 1 && <span className="text-slate-400">,</span>}
                    </span>
                  ))}
                </div>
              ) : null}
            </td>
            <td
              className={cn(
                "py-3 px-2 text-center",
                isBlockedHoliday ? "bg-[#EDE9FE]" : "",
                dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : "",
                isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-amber-100/50"
              )}
              onClick={() => isAdmin && !isBlockedHoliday && onPTOClick?.(day.fullDate, 'PM')}
            >
              {isBlockedHoliday ? (
                <span className="text-slate-400">-</span>
              ) : pmStaff.length > 0 ? (
                <div className="flex flex-wrap gap-x-1 justify-center text-[13px]">
                  {pmStaff.map((entry, idx) => (
                    <span key={entry.name} className="text-amber-700">
                      {entry.name}
                      {idx < pmStaff.length - 1 && <span className="text-slate-400">,</span>}
                    </span>
                  ))}
                </div>
              ) : null}
            </td>
          </Fragment>
        )
      })}
      {showWeekend && weekendDates.map((day, idx) => (
        <Fragment key={day.date}>
          <td className="py-3 px-2 text-center bg-slate-100/60 border-r border-slate-200/60">
            <span className="text-slate-400">-</span>
          </td>
          <td className={cn(
            "py-3 px-2 text-center bg-slate-100/60",
            idx < weekendDates.length - 1 ? "border-r border-slate-200" : ""
          )}>
            <span className="text-slate-400">-</span>
          </td>
        </Fragment>
      ))}
    </tr>
  )
}

// ============================================
// CAPACITY ROWS
// ============================================

function CapacityRows({
  weekdayDates,
  weekendDates,
  showWeekend,
  capacityData
}: {
  weekdayDates: WeekDate[]
  weekendDates: WeekDate[]
  showWeekend: boolean
  capacityData: DayCapacity[]
}) {
  const capacityTypes = [
    { key: "echo" as const, label: "Echo", color: "text-blue-600" },
    { key: "stressEcho" as const, label: "Stress Echo", color: "text-teal-600" },
    { key: "vascular" as const, label: "Vascular", color: "text-indigo-600" },
  ]

  return (
    <>
      {capacityTypes.map((type, idx) => (
        <tr key={type.key} className={cn(
          "border-b border-slate-200",
          idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
        )}>
          <td className={cn(
            "py-2.5 px-4 sticky left-0 z-10 border-r border-slate-200",
            idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
          )}>
            <span className={cn("text-sm font-semibold hover:underline cursor-pointer", type.color)}>{type.label}</span>
          </td>
          {weekdayDates.map((day, dayIdx) => {
            const dayData = capacityData.find(d => d.date === day.date)
            const isBlockedHoliday = day.holiday?.block_assignments ?? false
            const value = isBlockedHoliday ? "-" : (dayData ? dayData[type.key] : "-")
            return (
              <td key={day.date} colSpan={2} className={cn(
                "py-2.5 px-2 text-center",
                isBlockedHoliday ? "bg-[#EDE9FE]" : "",
                dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : ""
              )}>
                <span className={cn(
                  "text-lg font-bold",
                  isBlockedHoliday ? "text-slate-400" : "text-[#003366]"
                )}>{value}</span>
              </td>
            )
          })}
          {showWeekend && weekendDates.map((day, dayIdx) => (
            <td key={day.date} colSpan={2} className={cn(
              "py-2.5 px-2 text-center bg-slate-100/60",
              dayIdx < weekendDates.length - 1 ? "border-r border-slate-200" : ""
            )}>
              <span className="text-slate-400">-</span>
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ============================================
// BULK ASSIGN FLOATING BAR (Feature 8)
// ============================================

function BulkAssignBar({
  count,
  echoTechs,
  onAssign,
  onClear,
}: {
  count: number
  echoTechs: EchoTech[]
  onAssign: (techId: string) => void
  onClear: () => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const available = echoTechs.filter(t => t.is_active)
  const filtered = search
    ? available.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : available

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#003366] text-white rounded-lg shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom fade-in duration-200">
      <span className="text-sm font-medium">{count} cell{count !== 1 ? 's' : ''} selected</span>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
        >
          Assign Tech...
        </button>
        {open && (
          <div className="absolute bottom-full mb-2 left-0 w-52 bg-white rounded-lg shadow-xl border border-slate-200 text-slate-800">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search techs..."
              className="w-full px-3 py-2 text-sm border-b border-slate-200 rounded-t-lg outline-none"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(tech => (
                <button
                  key={tech.id}
                  onClick={() => {
                    onAssign(tech.id)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between"
                >
                  <span>{tech.name}</span>
                  <span className="text-gray-400 text-xs">cap:{tech.capacity_per_half_day}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No techs found</div>
              )}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onClear}
        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
      >
        Clear
      </button>
    </div>
  )
}

// ============================================
// MAIN SCHEDULE GRID
// ============================================

export function ScheduleGrid({
  dateRange,
  echoTechs,
  echoRooms,
  assignments,
  ptoDays,
  holidays = [],
  isAdmin,
  onCellClick,
  onPTOClick,
  onQuickDelete,
  onQuickAssign,
  onBulkAssign,
  onMoveAssignment,
  collapsedCategories,
  onToggleCategory,
  onRoomReorder
}: ScheduleGridProps) {
  const [showWeekend, setShowWeekend] = useState(false)

  // Phase 2 state
  const [inlineAssignCell, setInlineAssignCell] = useState<string | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [focusedCellKey, setFocusedCellKey] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragName, setActiveDragName] = useState<string | null>(null)

  // Transform the data
  const weekDates = useMemo(() => transformDates(dateRange, holidays), [dateRange, holidays])
  const labSections = useMemo(
    () => transformRooms(echoRooms, dateRange, assignments, echoTechs),
    [echoRooms, dateRange, assignments, echoTechs]
  )
  const ptoData = useMemo(
    () => transformPTO(ptoDays, echoTechs, dateRange),
    [ptoDays, echoTechs, dateRange]
  )
  const capacityData = useMemo(
    () => transformCapacity(dateRange, assignments, echoTechs, echoRooms),
    [dateRange, assignments, echoTechs, echoRooms]
  )

  const weekdayDates = weekDates.filter((d) => !d.isWeekend)
  const weekendDates = weekDates.filter((d) => d.isWeekend)

  // Build a flat list of all cell keys for keyboard navigation
  const allCellKeys = useMemo(() => {
    const keys: string[] = []
    labSections.forEach(section => {
      if (collapsedCategories?.has(section.name)) return
      section.rooms.forEach(room => {
        weekdayDates.forEach(day => {
          keys.push(cellKey(room.id, day.fullDate, 'AM'))
          keys.push(cellKey(room.id, day.fullDate, 'PM'))
        })
      })
    })
    return keys
  }, [labSections, weekdayDates, collapsedCategories])

  // Multi-cell select toggle
  const handleShiftClick = useCallback((key: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // Bulk assign handler
  const handleBulkAssign = useCallback((techId: string) => {
    if (onBulkAssign && selectedCells.size > 0) {
      const cells: CellId[] = []
      selectedCells.forEach(key => {
        const parsed = parseCellKey(key)
        if (parsed) cells.push(parsed)
      })
      onBulkAssign(cells, techId)
      setSelectedCells(new Set())
    }
  }, [onBulkAssign, selectedCells])

  // Keyboard navigation
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, roomId: string, date: string, timeBlock: 'AM' | 'PM') => {
    const currentKey = cellKey(roomId, date, timeBlock)
    const currentIdx = allCellKeys.indexOf(currentKey)

    // Number of AM/PM columns per row (weekdayDates.length * 2)
    const colsPerRow = weekdayDates.length * 2

    let targetIdx = -1
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        targetIdx = currentIdx + 1
        break
      case 'ArrowLeft':
        e.preventDefault()
        targetIdx = currentIdx - 1
        break
      case 'ArrowDown':
        e.preventDefault()
        targetIdx = currentIdx + colsPerRow
        break
      case 'ArrowUp':
        e.preventDefault()
        targetIdx = currentIdx - colsPerRow
        break
      case 'Enter':
        e.preventDefault()
        // Open inline assign if empty, or modal if filled
        {
          const cellAssignments = assignments.filter(
            a => a.echo_room_id === roomId && a.date === date && a.time_block === timeBlock
          )
          if (cellAssignments.length === 0 && onQuickAssign) {
            setInlineAssignCell(currentKey)
          } else {
            onCellClick?.(roomId, date, timeBlock)
          }
        }
        return
      case 'Backspace':
      case 'Delete':
        e.preventDefault()
        // Delete first assignment in this cell
        {
          const cellAssignments = assignments.filter(
            a => a.echo_room_id === roomId && a.date === date && a.time_block === timeBlock
          )
          if (cellAssignments.length > 0 && onQuickDelete) {
            onQuickDelete(cellAssignments[0].id)
          }
        }
        return
      case 'Escape':
        e.preventDefault()
        setInlineAssignCell(null)
        setSelectedCells(new Set())
        return
      default:
        return
    }

    if (targetIdx >= 0 && targetIdx < allCellKeys.length) {
      const targetKey = allCellKeys[targetIdx]
      setFocusedCellKey(targetKey)
      // Focus the element
      const el = document.querySelector(`[data-cellkey="${targetKey}"]`) as HTMLElement
      el?.focus()
    }
  }, [allCellKeys, weekdayDates.length, assignments, onQuickAssign, onCellClick, onQuickDelete])

  // DnD - single top-level context for both room sort and assignment drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const id = String(active.id)
    if (id.startsWith('assign-')) {
      const assignmentId = id.replace('assign-', '')
      setActiveDragId(assignmentId)
      const data = active.data.current as { name?: string } | undefined
      setActiveDragName(data?.name || 'Tech')
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setActiveDragName(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Assignment drag → drop on cell
    if (activeId.startsWith('assign-') && overId.startsWith('cell-')) {
      const assignmentId = activeId.replace('assign-', '')
      const targetCellKey = overId.replace('cell-', '')
      const parsed = parseCellKey(targetCellKey)
      if (parsed && onMoveAssignment) {
        onMoveAssignment(assignmentId, parsed.roomId, parsed.date, parsed.timeBlock)
      }
      return
    }

    // Room sort (both IDs are room UUIDs, not prefixed)
    if (!activeId.startsWith('assign-') && !activeId.startsWith('cell-') &&
        !overId.startsWith('assign-') && !overId.startsWith('cell-')) {
      if (activeId !== overId) {
        // Find which section these rooms belong to and reorder
        labSections.forEach(section => {
          const roomIds = section.rooms.map(r => r.id)
          if (roomIds.includes(activeId) && roomIds.includes(overId)) {
            const oldIndex = roomIds.indexOf(activeId)
            const newIndex = roomIds.indexOf(overId)
            const newOrder = arrayMove(roomIds, oldIndex, newIndex)
            onRoomReorder?.(section.name, newOrder)
          }
        })
      }
    }
  }

  const isDragEnabled = !!(isAdmin && onMoveAssignment)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Single unified table for Capacity + Schedule Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Capacity Section Header */}
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
                  Capacity
                </th>
                {weekdayDates.map((day, idx) => {
                  const hasHoliday = !!day.holiday
                  const isBlockedHoliday = day.holiday?.block_assignments ?? false
                  return (
                    <th
                      key={day.date}
                      colSpan={2}
                      className={cn(
                        "py-3 px-2 text-center",
                        isBlockedHoliday ? "bg-[#EDE9FE]" : "bg-slate-50",
                        idx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : ""
                      )}
                    >
                      <div className={cn(
                        "text-sm font-bold",
                        hasHoliday ? "text-[#7C3AED]" : "text-[#003366]"
                      )}>
                        {day.dayName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">{day.date}</div>
                      {hasHoliday && (
                        <div className="text-[10px] text-[#7C3AED] font-medium mt-0.5 truncate max-w-[80px] mx-auto" title={day.holiday!.name}>
                          {day.holiday!.name}
                        </div>
                      )}
                    </th>
                  )
                })}
                {showWeekend && weekendDates.map((day, idx) => (
                  <th
                    key={day.date}
                    colSpan={2}
                    className={cn(
                      "py-3 px-2 text-center bg-slate-100",
                      idx < weekendDates.length - 1 ? "border-r border-slate-200" : ""
                    )}
                  >
                    <div className="text-sm font-medium text-slate-400">{day.dayName}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{day.date}</div>
                  </th>
                ))}
              </tr>
            </thead>
            {/* Capacity Rows */}
            <tbody>
              <CapacityRows
                weekdayDates={weekdayDates}
                weekendDates={weekendDates}
                showWeekend={showWeekend}
                capacityData={capacityData}
              />
            </tbody>
            {/* Schedule Grid Header */}
            <thead>
              <tr className="bg-[#003366]">
                <th rowSpan={2} className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider w-48 sticky left-0 bg-[#0d4a6e] z-20 border-r border-[#0d4a6e] text-white">
                  Location
                </th>
                {weekdayDates.map((day, idx) => {
                  const hasHoliday = !!day.holiday
                  const isBlockedHoliday = day.holiday?.block_assignments ?? false
                  return (
                    <th
                      key={day.date}
                      colSpan={2}
                      className={cn(
                        "py-2.5 px-2 text-center text-sm font-semibold",
                        isBlockedHoliday ? "bg-[#7C3AED] text-violet-100" : "text-white",
                        idx < weekdayDates.length - 1 || showWeekend ? "border-r border-[#004080]" : ""
                      )}
                    >
                      <div>{day.dayName} {day.date}</div>
                      {hasHoliday && (
                        <div className={cn(
                          "text-[10px] font-medium mt-0.5 truncate max-w-[80px] mx-auto",
                          isBlockedHoliday ? "text-violet-200" : "text-blue-200"
                        )} title={day.holiday!.name}>
                          {day.holiday!.name}
                        </div>
                      )}
                    </th>
                  )
                })}
                {showWeekend && weekendDates.map((day, idx) => (
                  <th
                    key={day.date}
                    colSpan={2}
                    className={cn(
                      "py-2.5 px-2 text-center text-sm font-medium bg-[#002244] text-slate-400",
                      idx < weekendDates.length - 1 ? "border-r border-[#003355]" : ""
                    )}
                  >
                    {day.dayName} {day.date}
                  </th>
                ))}
              </tr>
              <tr className="bg-[#004477]">
                {weekdayDates.map((day, i) => {
                  const isBlockedHoliday = day.holiday?.block_assignments ?? false
                  return (
                    <Fragment key={day.date}>
                      <th className={cn(
                        "py-2 px-2 font-semibold text-xs border-r border-[#003366]/40",
                        isBlockedHoliday ? "bg-[#6D28D9] text-violet-100" : "text-blue-100"
                      )}>
                        AM
                      </th>
                      <th className={cn(
                        "py-2 px-2 font-semibold text-xs",
                        isBlockedHoliday ? "bg-[#6D28D9] text-violet-100" : "text-blue-100",
                        i < weekdayDates.length - 1 || showWeekend ? "border-r border-[#003366]" : ""
                      )}>
                        PM
                      </th>
                    </Fragment>
                  )
                })}
                {showWeekend && weekendDates.map((day, i) => (
                  <Fragment key={day.date}>
                    <th className="py-2 px-2 font-medium text-xs bg-[#002244] text-slate-500 border-r border-[#003355]/40">
                      AM
                    </th>
                    <th className={cn("py-2 px-2 font-medium text-xs bg-[#002244] text-slate-500", i < weekendDates.length - 1 ? "border-r border-[#003355]" : "")}>
                      PM
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <PTORow
                weekdayDates={weekdayDates}
                weekendDates={weekendDates}
                showWeekend={showWeekend}
                ptoData={ptoData}
                isAdmin={isAdmin}
                onPTOClick={onPTOClick}
              />
              {labSections.map((section) => (
                <LabSectionComponent
                  key={section.name}
                  section={section}
                  weekdayDates={weekdayDates}
                  weekendDates={weekendDates}
                  showWeekend={showWeekend}
                  ptoData={ptoData}
                  isAdmin={isAdmin}
                  onCellClick={onCellClick}
                  onQuickDelete={onQuickDelete}
                  isCollapsed={collapsedCategories?.has(section.name)}
                  onToggle={() => onToggleCategory?.(section.name)}
                  onRoomReorder={onRoomReorder}
                  inlineAssignCell={inlineAssignCell}
                  onSetInlineAssign={setInlineAssignCell}
                  onQuickAssign={onQuickAssign}
                  echoTechs={echoTechs}
                  assignments={assignments}
                  selectedCells={selectedCells}
                  onShiftClick={handleShiftClick}
                  focusedCellKey={focusedCellKey}
                  onFocusCell={setFocusedCellKey}
                  onKeyDown={handleCellKeyDown}
                  isDragEnabled={isDragEnabled}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Drag overlay for assignment drag (Feature 9) */}
        <DragOverlay>
          {activeDragId && (
            <div className="px-3 py-1.5 bg-[#003366] text-white rounded-full text-xs font-medium shadow-lg whitespace-nowrap">
              {activeDragName}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Multi-cell bulk assign bar (Feature 8) */}
      {selectedCells.size > 0 && isAdmin && (
        <BulkAssignBar
          count={selectedCells.size}
          echoTechs={echoTechs}
          onAssign={handleBulkAssign}
          onClear={() => setSelectedCells(new Set())}
        />
      )}

      {/* Legend & Weekend Toggle */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <span className="font-semibold text-slate-600 uppercase tracking-wide">Legend</span>
          <div className="flex items-center gap-2">
            <span className="text-amber-600 font-bold">--</span>
            <span className="text-slate-600">Unassigned (weekday)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-600">Conflict (double-booked or PTO)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-3 rounded-sm bg-slate-200 border border-slate-300"></div>
            <span className="text-slate-600">Weekend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-3 rounded-sm bg-[#EDE9FE] border border-[#C4B5FD]"></div>
            <span className="text-slate-600">Holiday (blocked)</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowWeekend(!showWeekend)}
          className="text-xs gap-1.5 bg-white border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
        >
          {showWeekend ? (
            <>
              <ChevronFirst className="w-4 h-4" />
              Hide Weekend
            </>
          ) : (
            <>
              Show Weekend
              <ChevronLast className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
