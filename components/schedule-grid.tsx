"use client"

import { useState, useMemo } from "react"
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
  fullDate: string // YYYY-MM-DD format for lookups
  isWeekend: boolean
  holiday?: Holiday // Holiday info if this date is a holiday
}

interface TimeSlot {
  am: string[]
  pm: string[]
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
  collapsedCategories?: Set<string>
  onToggleCategory?: (category: string) => void
  onRoomReorder?: (category: string, roomIds: string[]) => void
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

  // Group rooms by category
  const roomsByCategory: Record<string, EchoRoom[]> = {}
  echoRooms.forEach(room => {
    if (!roomsByCategory[room.category]) {
      roomsByCategory[room.category] = []
    }
    roomsByCategory[room.category].push(room)
  })

  // Create labSections structure
  const sections: LabSection[] = []

  // Define category order (CVI first, then Fourth Floor Lab)
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
          pm: pmAssignments.map(a => techMap.get(a.echo_tech_id)?.name || 'Unknown')
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

function transformPTO(
  ptoDays: EchoPTO[],
  echoTechs: EchoTech[],
  dateRange: string[]
): Record<string, string[]> {
  const techMap = new Map(echoTechs.map(t => [t.id, t]))
  const ptoData: Record<string, string[]> = {}

  dateRange.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const month = date.getMonth() + 1
    const day = date.getDate()
    const displayDate = `${month}/${day}`

    const dayPTO = ptoDays.filter(p => p.date === dateStr)
    const techNames = [...new Set(dayPTO.map(p => techMap.get(p.echo_tech_id)?.name || 'Unknown'))]

    ptoData[displayDate] = techNames
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
      const day = date.getDate()

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
        date: `${month}/${day}`,
        dayName: days[date.getDay()],
        echo: calculateCapacity('echo'),
        stressEcho: calculateCapacity('stress_echo'),
        vascular: calculateCapacity('vascular')
      }
    })
}

function StaffCell({
  staff,
  ptoStaff,
  isWeekend = false,
  isBlockedHoliday = false
}: {
  staff: string[]
  ptoStaff: string[]
  isWeekend?: boolean
  isBlockedHoliday?: boolean
}) {
  if (isWeekend || isBlockedHoliday) {
    return <span className="text-slate-400">-</span>
  }

  if (staff.length === 0) {
    return <span className="text-amber-600 font-semibold">--</span>
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {staff.map((name) => {
        const isConflict = ptoStaff.includes(name)
        return (
          <span
            key={name}
            className={cn(
              "text-[13px] leading-tight",
              isConflict ? "text-amber-600 font-semibold" : "text-slate-700"
            )}
          >
            {isConflict && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
            {name}
          </span>
        )
      })}
    </div>
  )
}

function SortableRoomRow({
  room,
  weekdayDates,
  weekendDates,
  showWeekend,
  isOdd,
  ptoData,
  isAdmin,
  onCellClick
}: {
  room: RoomSchedule
  weekdayDates: WeekDate[]
  weekendDates: WeekDate[]
  showWeekend: boolean
  isOdd: boolean
  ptoData: Record<string, string[]>
  isAdmin?: boolean
  onCellClick?: (roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const bgColor = isOdd ? "bg-slate-50/50" : "bg-white"

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn("border-b border-slate-200/80 hover:bg-blue-50/40 transition-colors", bgColor, isDragging && "bg-blue-100")}
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
        const ptoStaff = ptoData[day.date] || []
        const isBlockedHoliday = day.holiday?.block_assignments ?? false

        return (
          <Fragment key={day.date}>
            <td
              className={cn(
                "py-2.5 px-2 text-center border-r border-slate-100",
                isBlockedHoliday ? "bg-[#EDE9FE]" : bgColor,
                isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-blue-100/50"
              )}
              onClick={() => isAdmin && !isBlockedHoliday && onCellClick?.(room.id, day.fullDate, 'AM')}
            >
              <StaffCell staff={amStaff} ptoStaff={ptoStaff} isBlockedHoliday={isBlockedHoliday} />
            </td>
            <td
              className={cn(
                "py-2.5 px-2 text-center",
                isBlockedHoliday ? "bg-[#EDE9FE]" : bgColor,
                dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : "",
                isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-blue-100/50"
              )}
              onClick={() => isAdmin && !isBlockedHoliday && onCellClick?.(room.id, day.fullDate, 'PM')}
            >
              <StaffCell staff={pmStaff} ptoStaff={ptoStaff} isBlockedHoliday={isBlockedHoliday} />
            </td>
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

function LabSectionComponent({
  section,
  weekdayDates,
  weekendDates,
  showWeekend,
  ptoData,
  isAdmin,
  onCellClick,
  isCollapsed,
  onToggle,
  onRoomReorder
}: {
  section: LabSection
  weekdayDates: WeekDate[]
  weekendDates: WeekDate[]
  showWeekend: boolean
  ptoData: Record<string, string[]>
  isAdmin?: boolean
  onCellClick?: (roomId: string, date: string, timeBlock: 'AM' | 'PM') => void
  isCollapsed?: boolean
  onToggle?: () => void
  onRoomReorder?: (category: string, roomIds: string[]) => void
}) {
  const [localExpanded, setLocalExpanded] = useState(section.isExpanded)
  const [rooms, setRooms] = useState(section.rooms)
  const isExpanded = isCollapsed !== undefined ? !isCollapsed : localExpanded
  const totalCols = 1 + (weekdayDates.length * 2) + (showWeekend ? weekendDates.length * 2 : 0)

  // Update rooms when section.rooms changes
  useMemo(() => {
    setRooms(section.rooms)
  }, [section.rooms])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setRooms((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)

        // Call the callback with the new order
        if (onRoomReorder) {
          onRoomReorder(section.name, newItems.map((r) => r.id))
        }

        return newItems
      })
    }
  }

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setLocalExpanded(!localExpanded)
    }
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
      {isExpanded && isAdmin && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            {rooms.map((room, idx) => (
              <SortableRoomRow
                key={room.id}
                room={room}
                weekdayDates={weekdayDates}
                weekendDates={weekendDates}
                showWeekend={showWeekend}
                isOdd={idx % 2 === 1}
                ptoData={ptoData}
                isAdmin={isAdmin}
                onCellClick={onCellClick}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      {isExpanded && !isAdmin &&
        rooms.map((room, idx) => (
          <SortableRoomRow
            key={room.id}
            room={room}
            weekdayDates={weekdayDates}
            weekendDates={weekendDates}
            showWeekend={showWeekend}
            isOdd={idx % 2 === 1}
            ptoData={ptoData}
            isAdmin={isAdmin}
            onCellClick={onCellClick}
          />
        ))}
    </>
  )
}

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
  ptoData: Record<string, string[]>
  isAdmin?: boolean
  onPTOClick?: (date: string, timeBlock: 'AM' | 'PM') => void
}) {
  return (
    <tr className="bg-amber-50/50 border-b border-slate-200">
      <td className="py-3 px-4 sticky left-0 bg-amber-50/50 z-10 border-r border-slate-200">
        <span className="font-semibold text-sm text-amber-700">PTO</span>
      </td>
      {weekdayDates.map((day, dayIdx) => {
        const staff = ptoData[day.date] || []
        const isBlockedHoliday = day.holiday?.block_assignments ?? false
        return (
          <td
            key={day.date}
            colSpan={2}
            className={cn(
              "py-3 px-2 text-center",
              isBlockedHoliday ? "bg-[#EDE9FE]" : "",
              dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : "",
              isAdmin && !isBlockedHoliday && "cursor-pointer hover:bg-amber-100/50"
            )}
            onClick={() => isAdmin && !isBlockedHoliday && onPTOClick?.(day.fullDate, 'AM')}
          >
            {isBlockedHoliday ? (
              <span className="text-slate-400">-</span>
            ) : staff.length > 0 ? (
              <div className="flex flex-wrap gap-x-1 justify-center text-[13px]">
                {staff.map((name, idx) => (
                  <span key={name} className="text-amber-700">
                    {name}
                    {!name.includes("(off)") && <span className="text-amber-600/70"> (off)</span>}
                    {idx < staff.length - 1 && <span className="text-slate-400">,</span>}
                  </span>
                ))}
              </div>
            ) : null}
          </td>
        )
      })}
      {showWeekend && weekendDates.map((day, idx) => (
        <td key={day.date} colSpan={2} className={cn(
          "py-3 px-2 text-center bg-slate-100/60",
          idx < weekendDates.length - 1 ? "border-r border-slate-200" : ""
        )}>
          <span className="text-slate-400">-</span>
        </td>
      ))}
    </tr>
  )
}

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
  collapsedCategories,
  onToggleCategory,
  onRoomReorder
}: ScheduleGridProps) {
  const [showWeekend, setShowWeekend] = useState(false)

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

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
            {/* Day header row */}
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
            {/* AM/PM subheader row */}
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
                isCollapsed={collapsedCategories?.has(section.name)}
                onToggle={() => onToggleCategory?.(section.name)}
                onRoomReorder={onRoomReorder}
              />
            ))}
          </tbody>
        </table>
      </div>

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
