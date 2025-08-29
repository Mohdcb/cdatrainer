"use client"

import { useState, useMemo } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Badge } from "../../components/ui/badge"
import { Toast, useToast } from "../../components/ui/toast"
import { ChevronLeft, ChevronRight, Filter, CalendarIcon, Users, BookOpen } from "lucide-react"
import { getSupabaseClient } from "../../lib/supabaseClient"

export default function Calendar2Page() {
  const { batches, courses, subjects, trainers, holidays, schedules, loading, setSchedules } = useData()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedCourse, setSelectedCourse] = useState<string>("all")
  const [batchVisibility, setBatchVisibility] = useState<string>("active")
  const { toast, showToast, hideToast } = useToast()
  
  // State for trainer assignment changes
  const [editingSession, setEditingSession] = useState<{
    batchId: string
    subjectId: string
    date: string
    currentTrainerId: string | null
  } | null>(null)

  // Get current week dates (Monday to Sunday - weekends show "No Class")
  const getCurrentWeekDates = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1) // Monday
    
    const weekDates = []
    for (let i = 0; i < 7; i++) { // All 7 days
      const date = new Date(startOfWeek) // ✅ FIXED: Use startOfWeek as base
      date.setDate(startOfWeek.getDate() + i)
      weekDates.push(date)
    }
    return weekDates
  }

  const weekDates = getCurrentWeekDates()
  
  // Debug week calculation
  console.log(`[CALENDAR] Current date: ${currentDate.toDateString()}`)
  console.log(`[CALENDAR] Week dates: ${weekDates.map(d => d.toDateString()).join(' → ')}`)

  // Filter batches based on selected filters and batch status
  const filteredBatches = useMemo(() => {
    // Get the current week's date range for batch visibility logic
    const currentWeekStart = weekDates[0] // Monday of current week
    const currentWeekEnd = weekDates[6]   // Sunday of current week
    
    console.log(`[CALENDAR] Filtering batches for week: ${currentWeekStart.toDateString()} to ${currentWeekEnd.toDateString()}`)
    
    return batches.filter((batch) => {
      // Location filter
      if (selectedLocation !== "all" && batch.location !== selectedLocation) {
        console.log(`[CALENDAR] Batch ${batch.name} filtered out: location mismatch`)
        return false
      }
      
      // Course filter
      if (selectedCourse !== "all" && batch.courseId !== selectedCourse) {
        console.log(`[CALENDAR] Batch ${batch.name} filtered out: course mismatch`)
        return false
      }
      
      // Batch visibility filter based on user selection
      if (batchVisibility === "active") {
        // Show only active batches within current week
        if (batch.status === "completed" || batch.status === "cancelled") {
          console.log(`[CALENDAR] Batch ${batch.name} filtered out: status is ${batch.status}`)
          return false
        }
        
        // Hide batches that have ended before current week
        if (batch.endDate) {
          const batchEndDate = new Date(batch.endDate)
          if (batchEndDate < currentWeekStart) {
            console.log(`[CALENDAR] Batch ${batch.name} filtered out: ended on ${batchEndDate.toDateString()} before current week`)
            return false
          }
        }
        
        // Hide batches that haven't started yet
        if (batch.startDate) {
          const batchStartDate = new Date(batch.startDate)
          if (batchStartDate > currentWeekEnd) {
            console.log(`[CALENDAR] Batch ${batch.name} filtered out: starts on ${batchStartDate.toDateString()} after current week`)
            return false
          }
        }
      } else if (batchVisibility === "completed") {
        // Show only completed batches
        if (batch.status !== "completed") {
          console.log(`[CALENDAR] Batch ${batch.name} filtered out: status is not completed`)
          return false
        }
      }
      // If batchVisibility === "all", show all batches regardless of status
      
      console.log(`[CALENDAR] Batch ${batch.name} included: active and within date range`)
      return true
    })
  }, [batches, selectedLocation, selectedCourse, weekDates, batchVisibility])

  // Get sessions for a specific batch and date
  const getSessionsForBatchAndDate = (batchId: string, date: string) => {
    console.log('Looking for sessions:', { batchId, date, allSchedules: schedules })
    const filtered = schedules.filter((session) => 
      session.batchId === batchId && session.date === date
    )
    console.log('Found sessions:', filtered)
    return filtered
  }

  // Test function to check database access
  const testDatabaseAccess = async () => {
    try {
      const supabase = getSupabaseClient()
      console.log('Testing database access...')
      
      // First, let's try to get the table structure
      const { data: structureData, error: structureError } = await supabase
        .from('schedules')
        .select('*')
        .limit(0)
      
      if (structureError) {
        console.error('Structure check error:', structureError)
      } else {
        console.log('Table structure check passed')
      }
      
      // Now try to get some actual data
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .limit(5)
      
      if (error) {
        console.error('Database test error:', error)
      } else {
        console.log('Database test success:', data)
        if (data && data.length > 0) {
          console.log('Sample record structure:', Object.keys(data[0]))
          console.log('Sample record:', data[0])
        }
      }
    } catch (err) {
      console.error('Database test exception:', err)
    }
  }

  // Handle trainer assignment change
  const handleTrainerChange = async (batchId: string, subjectId: string, date: string, newTrainerId: string | null) => {
    try {
      const supabase = getSupabaseClient()
      console.log('Updating trainer assignment:', { batchId, subjectId, date, newTrainerId })
      
      if (newTrainerId === null) {
        // Remove trainer assignment - delete the session using composite key
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('batch_id', batchId)
          .eq('subject_id', subjectId)
          .eq('date', date)
        
        if (error) {
          console.error('Delete error:', error)
          console.error('Error code:', error.code)
          console.error('Error message:', error.message)
          console.error('Error details:', error.details)
          throw error
        }
        console.log('Session deleted successfully')
        
        // Update local state - remove the session
        setSchedules(prevSchedules => 
          prevSchedules.filter(s => 
            !(s.batchId === batchId && s.subjectId === subjectId && s.date === date)
          )
        )
      } else {
        // Update or create session with new trainer
        const existingSession = schedules.find(s => 
          s.batchId === batchId && s.subjectId === subjectId && s.date === date
        )
        
        console.log('Existing session:', existingSession)
        
        if (existingSession) {
          // Update existing session using composite key
          const { error } = await supabase
            .from('schedules')
            .update({ trainer_id: newTrainerId })
            .eq('batch_id', batchId)
            .eq('subject_id', subjectId)
            .eq('date', date)
          
          if (error) {
            console.error('Update error:', error)
            console.error('Error code:', error.code)
            console.error('Error message:', error.message)
            console.error('Error details:', error.details)
            throw error
          }
          console.log('Session updated successfully')
          
          // Update local state - update the existing session
          setSchedules(prevSchedules => 
            prevSchedules.map(s => 
              s.batchId === batchId && s.subjectId === subjectId && s.date === date
                ? { ...s, trainerId: newTrainerId, status: 'assigned' }
                : s
            )
          )
        } else {
          // Create new session
          const insertPayload = {
            batch_id: batchId,
            subject_id: subjectId,
            trainer_id: newTrainerId,
            date: date,
            start_time: '09:00',
            end_time: '17:00',
            status: 'planned'
          }
          
          console.log('Attempting to insert:', insertPayload)
          
          const { data: insertData, error } = await supabase
            .from('schedules')
            .insert(insertPayload)
            .select()
          
          if (error) {
            console.error('Insert error details:', error)
            console.error('Error code:', error.code)
            console.error('Error message:', error.message)
            console.error('Error details:', error.details)
            console.error('Error hint:', error.hint)
            console.error('Full error object:', JSON.stringify(error, null, 2))
            throw error
          }
          
          console.log('Session created successfully:', insertData)
          
          // Update local state - add the new session
          if (insertData && insertData[0]) {
            const newSession: any = insertData[0]
            const course = courses.find(c => c.id === batchId)
            setSchedules(prevSchedules => [
              ...prevSchedules,
              {
                id: String(newSession.schedule_id || newSession.id || Date.now()),
                batchId,
                courseId: course?.id || '',
                date: newSession.date,
                subjectId: newSession.subject_id,
                trainerId: newSession.trainer_id,
                status: 'assigned',
                timeSlot: `${newSession.start_time}-${newSession.end_time}`,
                sessionType: 'regular'
              }
            ])
          }
        }
      }
      
      // Show beautiful success toast
      showToast('Trainer assignment updated successfully! 🎉', 'success')
      
    } catch (error) {
      console.error('Error updating trainer assignment:', error)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      
      let errorMessage = 'Unknown error occurred'
      if (error && typeof error === 'object') {
        if ('message' in error) errorMessage = String(error.message)
        else if ('code' in error) errorMessage = `Error code: ${error.code}`
        else errorMessage = JSON.stringify(error)
      }
      
      showToast(`Failed to update trainer assignment: ${errorMessage}`, 'error')
    }
  }

  // Check if trainer is available for a specific date and subject
  const isTrainerAvailable = (trainerId: string, date: string, subjectId: string, currentBatchId?: string) => {
    const trainer = trainers.find(t => t.id === trainerId)
    if (!trainer) return false
    
    // Check if trainer has expertise in this subject
    const hasExpertise = trainer.expertise.some(exp => 
      exp.toLowerCase().includes(subjects.find(s => s.id === subjectId)?.name?.toLowerCase() || '') ||
      (subjects.find(s => s.id === subjectId)?.name?.toLowerCase() || '').includes(exp.toLowerCase())
    )
    
    if (!hasExpertise) return false
    
    // Check if trainer is already assigned to another session on this date
    // Only show as busy if they're assigned to a DIFFERENT batch/subject on the same date
    const hasConflict = schedules.some(s => 
      s.trainerId === trainerId && 
      s.date === date && 
      s.batchId !== currentBatchId // Allow if it's the same batch (reassigning)
    )
    
    return !hasConflict
  }

  // Get unique locations and courses for filters
  const locations = Array.from(new Set(batches.map((batch) => batch.location)))
  const courseOptions = courses.map(course => ({ id: course.id, name: course.name }))

  // Navigation functions
  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    console.log(`[CALENDAR] Previous week: ${currentDate.toDateString()} → ${newDate.toDateString()}`)
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    console.log(`[CALENDAR] Next week: ${currentDate.toDateString()} → ${newDate.toDateString()}`)
    setCurrentDate(newDate)
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar 2 - Batch View</h1>
          <p className="text-gray-600">
            Batch-centric calendar view • Each row represents a batch • One subject per day • Change trainers via dropdowns
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={navigateToday}>
            This Week
          </Button>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courseOptions.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={batchVisibility} onValueChange={setBatchVisibility}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Batch Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Show Active Only</SelectItem>
                <SelectItem value="all">Show All Batches</SelectItem>
                <SelectItem value="completed">Show Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>



            {/* Batch Calendar Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Week of {weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-primary/10 text-primary">
                {filteredBatches.length} Batches
              </Badge>
            </div>
          </CardTitle>
          
          {/* Calendar Legend */}
          <div className="flex items-center space-x-4 text-xs text-gray-600 mt-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
              <span>Holiday</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
              <span>Batch Not Started</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
              <span>Batch Ended</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-50 border border-purple-200 rounded"></div>
              <span>Non-Working Day</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-50 border border-orange-200 rounded"></div>
              <span>No Trainer Assigned</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
              <span>No Class Scheduled</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-white border border-gray-200 rounded"></div>
              <span>Normal (Trainer Assigned)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Batch Calendar Grid */}
          <div className="overflow-x-auto" style={{ width: '1460px', overflow: 'scroll' }}>
            <div className="grid gap-0 min-w-max border border-gray-200 rounded-lg overflow-hidden" style={{ gridTemplateColumns: '200px repeat(7, 180px)' }}>
            {/* Header Row */}
            <div className="p-3 text-left font-medium text-gray-700 bg-gray-50 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Batch</span>
              </div>
            </div>
            {weekDates.map((date, index) => (
              <div key={index} className="p-3 text-center font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-medium">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className="text-xs text-gray-500">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
            {/* Batch Rows */}
            {filteredBatches.map((batch) => {
              const course = courses.find(c => c.id === batch.courseId)
              
              console.log('Batch data:', { batch, course })
             
              return (
                <div key={batch.id} className="contents">
                  {/* Batch Info Column */}
                  <div key={`${batch.id}-info`} className="p-3 bg-white sticky left-0 z-20 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-b border-gray-200">
                    <div className="space-y-2">
                      <div className="font-medium text-gray-900">{batch.name}</div>
                      <div className="text-sm text-gray-600">
                        {course?.name} • {batch.location}
                      </div>
                      <div className="text-xs text-gray-500">
                        Course: {course?.name}
                      </div>
                    </div>
                  </div>
                  
                  {/* Day Columns */}
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = date.toISOString().split("T")[0]
                    const daySessions = getSessionsForBatchAndDate(batch.id, dateStr)
                    
                    // Check if this is a holiday
                    const isHoliday = holidays.some(holiday => 
                      holiday.date === dateStr
                    )
                    
                    // Check if this is a weekend day (Saturday = 6, Sunday = 0)
                    const dayOfWeek = date.getDay()
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                    
                    // Check if this day is a working day for this batch type
                    const isWorkingDayForBatch = (() => {
                      if (batch.batchType === "weekday") {
                        // Weekday batches: Monday-Friday are working days, Saturday-Sunday are not
                        return dayOfWeek >= 1 && dayOfWeek <= 5
                      } else if (batch.batchType === "weekend") {
                        // Weekend batches: Saturday-Sunday are working days, Monday-Friday are not
                        return dayOfWeek === 0 || dayOfWeek === 6
                      }
                      // Default to weekday behavior
                      return dayOfWeek >= 1 && dayOfWeek <= 5
                    })()
                    
                    // Check if batch has started and ended (compare with batch dates)
                    const batchStartDate = new Date(batch.startDate)
                    const batchEndDate = new Date(batch.endDate)
                    const currentDate = new Date(dateStr)
                    const batchHasStarted = currentDate >= batchStartDate
                    const batchHasEnded = currentDate > batchEndDate
                    
                    // Get the session for this date from schedules table
                    const session = daySessions[0] // Take first session if multiple exist
                    const daySubject = session ? subjects.find(s => s.id === session.subjectId) : null
                    const currentTrainer = trainers.find(t => t.id === session?.trainerId)
                    
                    // Determine what to show for this day
                    let dayContent
                    let dayStatus = "normal"
                    
                    if (isHoliday) {
                      dayStatus = "holiday"
                      dayContent = (
                        <div className="flex items-center justify-center h-full text-red-600 text-xs">
                          Holiday
                        </div>
                      )
                    } else if (!batchHasStarted) {
                      dayStatus = "not-started"
                      dayContent = (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          Batch Not Started
                        </div>
                      )
                    } else if (batchHasEnded) {
                      dayStatus = "ended"
                      dayContent = (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          Batch Ended
                        </div>
                      )
                    } else if (!isWorkingDayForBatch) {
                      // This day is not a working day for this batch type
                      dayStatus = "non-working"
                      dayContent = (
                        <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                          Non-Working Day
                        </div>
                      )
                    } else if (daySubject) {
                      // Subject is scheduled for this day
                      dayStatus = "scheduled"
                      dayContent = (
                        <div className="space-y-2 flex flex-col items-center">
                          <div className="font-medium text-gray-700 mb-2 text-center">
                            {daySubject.name}
                          </div>
                          
                          {/* Trainer Assignment Dropdown */}
                          <Select
                            value={session?.trainerId || "unassigned"}
                            onValueChange={(trainerId) => {
                              if (trainerId === "unassigned") {
                                handleTrainerChange(batch.id, daySubject.id, dateStr, null)
                              } else {
                                handleTrainerChange(batch.id, daySubject.id, dateStr, trainerId)
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assign trainer" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                <span className="text-red-600">Unassigned</span>
                              </SelectItem>
                              {trainers
                                .filter(trainer => {
                                  // Only show trainers with expertise in this subject
                                  const hasExpertise = trainer.expertise.some(exp => 
                                    exp.toLowerCase().includes(daySubject.name.toLowerCase()) ||
                                    daySubject.name.toLowerCase().includes(exp.toLowerCase())
                                  )
                                  return hasExpertise && trainer.status === "active"
                                })
                                .map((trainer) => {
                                  const isAvailable = isTrainerAvailable(trainer.id, dateStr, daySubject.id, batch.id)
                                  
                                  return (
                                    <SelectItem 
                                      key={trainer.id} 
                                      value={trainer.id}
                                      disabled={!isAvailable}
                                      className={!isAvailable ? "opacity-50 text-gray-500" : ""}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <span className={!isAvailable ? "text-gray-500" : ""}>
                                          {trainer.name}
                                        </span>
                                        {!isAvailable && (
                                          <Badge variant="destructive" className="text-xs">
                                            Busy
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  )
                                })}
                            </SelectContent>
                          </Select>
                          
                          {/* Show status badge */}
                          {!session?.trainerId && (
                            <div className="text-center">
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                No Trainer Assigned
                              </Badge>
                            </div>
                          )}
                        </div>
                      )
                    } else {
                      // No subject scheduled for this day
                      dayStatus = "no-class"
                      dayContent = (
                        <div className="space-y-2">
                          <div className="text-center text-gray-400 text-xs mb-2">
                            No Class Scheduled
                          </div>
                          
                          {/* Trainer Assignment Dropdown for unscheduled days */}
                          <Select
                            value="unassigned"
                            onValueChange={(trainerId) => {
                              if (trainerId !== "unassigned") {
                                // Create a new session with the selected trainer
                                // We need to get a subject for this day
                                const availableSubject = subjects.find(s => {
                                  const course = courses.find(c => c.id === batch.courseId)
                                  return course?.subjects?.includes(s.id)
                                })
                                
                                if (availableSubject) {
                                  handleTrainerChange(batch.id, availableSubject.id, dateStr, trainerId)
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Schedule & assign trainer" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                <span className="text-gray-500">No class scheduled</span>
                              </SelectItem>
                              {trainers
                                .filter(trainer => trainer.status === "active")
                                .map((trainer) => {
                                  const isAvailable = isTrainerAvailable(trainer.id, dateStr, '', batch.id)
                                  
                                  return (
                                    <SelectItem 
                                      key={trainer.id} 
                                      value={trainer.id}
                                      disabled={!isAvailable}
                                      className={!isAvailable ? "opacity-50 text-gray-500" : ""}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <span className={!isAvailable ? "text-gray-500" : ""}>
                                          {trainer.name}
                                        </span>
                                        {!isAvailable && (
                                          <Badge variant="destructive" className="text-xs">
                                            Busy
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  )
                                })}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    }
                    
                    // Apply different background colors based on status
                    let cellClassName = "p-2 border-r border-gray-200 border-b border-gray-200"
                    if (dayStatus === "holiday") {
                      cellClassName += " bg-red-50"
                    } else if (dayStatus === "not-started") {
                      cellClassName += " bg-gray-50"
                    } else if (dayStatus === "ended") {
                      cellClassName += " bg-gray-100"
                    } else if (dayStatus === "non-working") {
                      cellClassName += " bg-purple-50"
                    } else if (dayStatus === "scheduled" && !session?.trainerId) {
                      cellClassName += " bg-orange-50"
                    } else if (dayStatus === "no-class") {
                      cellClassName += " bg-blue-50"
                    }
                    
                    return (
                      <div key={`${batch.id}-${dayIndex}`} className={cellClassName}>
                        {dayContent}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
            </div>
          </CardContent>
        </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Total Batches</span>
                <span className="font-medium">{filteredBatches.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Online Batches</span>
                <span className="font-medium text-blue-600">
                  {filteredBatches.filter(b => b.location === "online").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Offline Batches</span>
                <span className="font-medium text-gray-600">
                  {filteredBatches.filter(b => b.location !== "online").length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Week Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Total Sessions</span>
                <span className="font-medium">{schedules.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Assigned Sessions</span>
                <span className="font-medium text-primary">
                  {schedules.filter(s => s.trainerId).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Unassigned Sessions</span>
                <span className="font-medium text-orange-600">
                  {schedules.filter(s => !s.trainerId).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setCurrentDate(new Date())}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Go to Current Week
              </Button>
                             <Button 
                 variant="outline" 
                 className="w-full justify-start"
                 onClick={() => {
                   setSelectedLocation("all")
                   setSelectedCourse("all")
                 }}
               >
                 <Filter className="w-4 h-4 mr-2" />
                 Clear Filters
               </Button>
               <Button 
                 variant="outline" 
                 className="w-full justify-start"
                 onClick={testDatabaseAccess}
               >
                 🧪 Test Database
               </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Beautiful Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={4000}
      />
    </MainLayout>
  )
}
