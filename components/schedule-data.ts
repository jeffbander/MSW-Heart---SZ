export interface DayCapacity {
  date: string
  dayName: string
  echo: number
  stressEcho: number
  vascular: number
}

export interface TimeSlot {
  am: string[]
  pm: string[]
}

export interface RoomSchedule {
  name: string
  location: string
  slots: Record<string, TimeSlot>
}

export interface LabSection {
  name: string
  roomCount: number
  rooms: RoomSchedule[]
  isExpanded: boolean
}

export const weekDates = [
  { date: "1/26", dayName: "Mon", isWeekend: false },
  { date: "1/27", dayName: "Tue", isWeekend: false },
  { date: "1/28", dayName: "Wed", isWeekend: false },
  { date: "1/29", dayName: "Thu", isWeekend: false },
  { date: "1/30", dayName: "Fri", isWeekend: false },
  { date: "1/31", dayName: "Sat", isWeekend: true },
  { date: "2/1", dayName: "Sun", isWeekend: true },
]

export const capacityData: DayCapacity[] = [
  { date: "1/26", dayName: "Mon", echo: 42, stressEcho: 10, vascular: 10 },
  { date: "1/27", dayName: "Tue", echo: 37, stressEcho: 10, vascular: 10 },
  { date: "1/28", dayName: "Wed", echo: 30, stressEcho: 10, vascular: 10 },
  { date: "1/29", dayName: "Thu", echo: 42, stressEcho: 10, vascular: 10 },
  { date: "1/30", dayName: "Fri", echo: 42, stressEcho: 10, vascular: 10 },
]

export const ptoData: Record<string, string[]> = {
  "1/26": [],
  "1/27": [],
  "1/28": ["Karina", "Tomy"],
  "1/29": ["Karina", "Tomy"],
  "1/30": ["Tomy"],
}

export const labSections: LabSection[] = [
  {
    name: "CVI",
    roomCount: 6,
    isExpanded: true,
    rooms: [
      {
        name: "Stress Echo Room",
        location: "Procedure Room 2 GB-62",
        slots: {
          "1/26": { am: ["Lisa"], pm: ["Lisa"] },
          "1/27": { am: ["Nancy"], pm: ["Nancy"] },
          "1/28": { am: ["Anna"], pm: ["Anna"] },
          "1/29": { am: ["Linda"], pm: ["Linda"] },
          "1/30": { am: ["Linda"], pm: ["Linda"] },
        },
      },
      {
        name: "Linda's Room",
        location: "Procedure Room 5 GB-64",
        slots: {
          "1/26": { am: ["Linda"], pm: ["Linda"] },
          "1/27": { am: ["Lisa"], pm: ["Linda"] },
          "1/28": { am: ["Lisa"], pm: ["Lisa"] },
          "1/29": { am: ["Lisa"], pm: ["Lisa"] },
          "1/30": { am: ["Lisa"], pm: ["Lisa"] },
        },
      },
      {
        name: "Lisa/Nancy Room",
        location: "Procedure Room 6 GB-66",
        slots: {
          "1/26": { am: ["Nancy"], pm: ["Nancy"] },
          "1/27": { am: ["Anna"], pm: ["Lisa"] },
          "1/28": { am: ["Nancy"], pm: ["Nancy"] },
          "1/29": { am: ["Nancy"], pm: ["Nancy"] },
          "1/30": { am: ["Nancy"], pm: ["Nancy"] },
        },
      },
      {
        name: "Anna/Karina Room",
        location: "Procedure Room 3 GB-65",
        slots: {
          "1/26": { am: ["Anna", "Karina"], pm: ["Anna", "Karina"] },
          "1/27": { am: ["Karina"], pm: ["Anna", "Karina"] },
          "1/28": { am: ["Linda"], pm: ["Linda"] },
          "1/29": { am: ["Anna", "Karina"], pm: ["Anna", "Karina"] },
          "1/30": { am: ["Anna", "Karina"], pm: ["Anna", "Karina"] },
        },
      },
      {
        name: "Wendy Vascular Room",
        location: "Procedure Room 7 & GB-68",
        slots: {
          "1/26": { am: ["Wendy"], pm: ["Wendy"] },
          "1/27": { am: ["Wendy"], pm: ["Wendy"] },
          "1/28": { am: ["Wendy"], pm: ["Wendy"] },
          "1/29": { am: ["Wendy"], pm: ["Wendy"] },
          "1/30": { am: ["Wendy"], pm: ["Wendy"] },
        },
      },
      {
        name: "Vascular/EP/echo",
        location: "Procedure Room 8 GB-68",
        slots: {
          "1/26": { am: [], pm: [] },
          "1/27": { am: [], pm: [] },
          "1/28": { am: [], pm: [] },
          "1/29": { am: [], pm: [] },
          "1/30": { am: [], pm: [] },
        },
      },
    ],
  },
  {
    name: "Fourth Floor Lab",
    roomCount: 6,
    isExpanded: false,
    rooms: [],
  },
]
