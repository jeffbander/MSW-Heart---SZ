"use client"

import { useState } from "react"
import { Fragment } from "react"
import { ChevronDown, ChevronRight, AlertTriangle, ChevronLast, ChevronFirst } from "lucide-react"
import { Button } from "@/components/ui/button"
import { weekDates, labSections, ptoData, capacityData, type LabSection } from "./schedule-data"
import { cn } from "@/lib/utils"

function StaffCell({ 
  staff, 
  ptoStaff, 
  isWeekend = false 
}: { 
  staff: string[]
  ptoStaff: string[]
  isWeekend?: boolean
}) {
  if (isWeekend) {
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

function RoomRow({ 
  room, 
  weekdayDates, 
  weekendDates, 
  showWeekend,
  isOdd
}: { 
  room: typeof labSections[0]["rooms"][0]
  weekdayDates: typeof weekDates
  weekendDates: typeof weekDates
  showWeekend: boolean
  isOdd: boolean
}) {
  const bgColor = isOdd ? "bg-slate-50/50" : "bg-white"
  
  return (
    <tr className={cn("border-b border-slate-200/80 hover:bg-blue-50/40 transition-colors", bgColor)}>
      <td className={cn("py-3 px-4 sticky left-0 z-10 border-r border-slate-200", bgColor)}>
        <div className="font-medium text-[13px] text-slate-800">{room.name}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{room.location}</div>
      </td>
      {weekdayDates.map((day, dayIdx) => {
        const slot = room.slots[day.date]
        const amStaff = slot?.am || []
        const pmStaff = slot?.pm || []
        const ptoStaff = ptoData[day.date] || []

        return (
          <Fragment key={day.date}>
            <td className={cn("py-2.5 px-2 text-center border-r border-slate-100", bgColor)}>
              <StaffCell staff={amStaff} ptoStaff={ptoStaff} />
            </td>
            <td className={cn(
              "py-2.5 px-2 text-center",
              bgColor,
              dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : ""
            )}>
              <StaffCell staff={pmStaff} ptoStaff={ptoStaff} />
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
  showWeekend 
}: { 
  section: LabSection
  weekdayDates: typeof weekDates
  weekendDates: typeof weekDates
  showWeekend: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(section.isExpanded)
  const totalCols = 1 + (weekdayDates.length * 2) + (showWeekend ? weekendDates.length * 2 : 0)

  return (
    <>
      <tr
        className="bg-gradient-to-r from-slate-100 to-slate-50 cursor-pointer hover:from-slate-200 hover:to-slate-100 transition-all border-b border-slate-200"
        onClick={() => setIsExpanded(!isExpanded)}
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
      {isExpanded &&
        section.rooms.map((room, idx) => (
          <RoomRow 
            key={room.name} 
            room={room} 
            weekdayDates={weekdayDates} 
            weekendDates={weekendDates} 
            showWeekend={showWeekend}
            isOdd={idx % 2 === 1}
          />
        ))}
    </>
  )
}

function PTORow({ 
  weekdayDates, 
  weekendDates, 
  showWeekend 
}: { 
  weekdayDates: typeof weekDates
  weekendDates: typeof weekDates
  showWeekend: boolean
}) {
  return (
    <tr className="bg-amber-50/50 border-b border-slate-200">
      <td className="py-3 px-4 sticky left-0 bg-amber-50/50 z-10 border-r border-slate-200">
        <span className="font-semibold text-sm text-amber-700">PTO</span>
      </td>
      {weekdayDates.map((day, dayIdx) => {
        const staff = ptoData[day.date] || []
        return (
          <td key={day.date} colSpan={2} className={cn(
            "py-3 px-2 text-center",
            dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : ""
          )}>
            {staff.length > 0 ? (
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

function CapacitySection({ 
  weekdayDates, 
  weekendDates, 
  showWeekend 
}: { 
  weekdayDates: typeof weekDates
  weekendDates: typeof weekDates
  showWeekend: boolean
}) {
  const capacityTypes = [
    { key: "echo" as const, label: "Echo", color: "text-blue-600" },
    { key: "stressEcho" as const, label: "Stress Echo", color: "text-teal-600" },
    { key: "vascular" as const, label: "Vascular", color: "text-indigo-600" },
  ]

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
            Capacity
          </th>
          {weekdayDates.map((day, idx) => (
            <th
              key={day.date}
              colSpan={2}
              className={cn(
                "py-3 px-2 text-center bg-slate-50",
                idx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : ""
              )}
            >
              <div className="text-sm font-bold text-[#003366]">{day.dayName}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">{day.date}</div>
            </th>
          ))}
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
      <tbody>
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
              const value = dayData ? dayData[type.key] : "-"
              return (
                <td key={day.date} colSpan={2} className={cn(
                  "py-2.5 px-2 text-center",
                  dayIdx < weekdayDates.length - 1 || showWeekend ? "border-r border-slate-200" : ""
                )}>
                  <span className="text-lg font-bold text-[#003366]">{value}</span>
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
      </tbody>
    </table>
  )
}

export function ScheduleGrid() {
  const [showWeekend, setShowWeekend] = useState(false)
  const weekdayDates = weekDates.filter((d) => !d.isWeekend)
  const weekendDates = weekDates.filter((d) => d.isWeekend)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Capacity Section */}
      <div className="overflow-x-auto">
        <CapacitySection 
          weekdayDates={weekdayDates} 
          weekendDates={weekendDates} 
          showWeekend={showWeekend} 
        />
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {/* Day header row */}
            <tr className="bg-[#003366]">
              <th rowSpan={2} className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider w-48 sticky left-0 bg-[#0d4a6e] z-20 border-r border-[#0d4a6e] text-white">
                Location
              </th>
              {weekdayDates.map((day, idx) => (
                <th
                  key={day.date}
                  colSpan={2}
                  className={cn(
                    "py-2.5 px-2 text-center text-sm font-semibold text-white",
                    idx < weekdayDates.length - 1 || showWeekend ? "border-r border-[#004080]" : ""
                  )}
                >
                  {day.dayName} {day.date}
                </th>
              ))}
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
              {weekdayDates.map((day, i) => (
                <Fragment key={day.date}>
                  <th className="py-2 px-2 font-semibold text-xs text-blue-100 border-r border-[#003366]/40">
                    AM
                  </th>
                  <th className={cn("py-2 px-2 font-semibold text-xs text-blue-100", i < weekdayDates.length - 1 || showWeekend ? "border-r border-[#003366]" : "")}>
                    PM
                  </th>
                </Fragment>
              ))}
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
            <PTORow weekdayDates={weekdayDates} weekendDates={weekendDates} showWeekend={showWeekend} />
            {labSections.map((section) => (
              <LabSectionComponent 
                key={section.name} 
                section={section} 
                weekdayDates={weekdayDates} 
                weekendDates={weekendDates} 
                showWeekend={showWeekend} 
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
