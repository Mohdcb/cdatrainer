"use client"

import { useState, useEffect } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Badge } from "../../components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Textarea } from "../../components/ui/textarea"
import { Plus, Search, Edit, Clock, BookOpen, Users } from "lucide-react"
import type { Course } from "../../hooks/useData"
import { getSupabaseClient } from "../../lib/supabaseClient"

export default function CoursesPage() {
  const { courses, subjects, setCourses, batches, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration: 0,
    subjects: [] as string[],
  })

  // Auto-calculate course duration when subjects change
  useEffect(() => {
    const totalDuration = formData.subjects.reduce((sum, subjectId) => {
      const s = subjects.find((sub) => sub.id === subjectId)
      return sum + (s ? Number(s.duration || 0) : 0)
    }, 0)
    setFormData(prev => ({ ...prev, duration: totalDuration }))
  }, [formData.subjects, subjects])

  const filteredCourses = courses.filter((course) => course.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const getCourseSubjects = (course: Course) => {
    return course.subjects.map((subjectId) => subjects.find((s) => s.id === subjectId)).filter(Boolean)
  }

  const getCourseBatches = (courseId: string) => {
    return batches.filter((batch) => batch.courseId === courseId)
  }

  const handleAddCourse = async () => {
    const supabase = getSupabaseClient()
    const totalDuration = formData.subjects.reduce((sum, subjectId) => {
      const s = subjects.find((sub) => sub.id === subjectId)
      return sum + (s ? Number(s.duration || 0) : 0)
    }, 0)
    const insertPayload = {
      course_name: formData.name,
      description: formData.description,
      duration_days: totalDuration,
    }
    const { data, error } = await supabase.from("courses").insert(insertPayload).select("*").single()
    if (error) {
      console.error("Failed to add course:", error)
      return
    }
    // Persist course curriculum order into course_subjects
    const courseIdNum = Number(data.course_id ?? data.id)
    if (formData.subjects.length > 0) {
      const rows = formData.subjects.map((subjectId: string, idx: number) => ({
        course_id: courseIdNum,
        subject_id: Number.parseInt(subjectId),
        position: idx,
      }))
      const { error: csError } = await supabase.from("course_subjects").insert(rows)
      if (csError) {
        console.error("Failed to insert course_subjects:", csError)
      }
    }
    const newCourse: Course = {
      id: String(data.course_id ?? data.id),
      name: data.course_name ?? formData.name,
      description: data.description ?? formData.description,
      duration: Number(data.duration_days ?? totalDuration),
      subjects: [...formData.subjects],
    }
    setCourses([...courses, newCourse])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      name: course.name,
      description: course.description,
      duration: course.duration,
      subjects: course.subjects,
    })
  }

  const handleDeleteCourse = (course: Course) => {
    setCourseToDelete(course)
    setDeleteConfirmOpen(true)
  }

  const performCourseDeletion = async () => {
    if (!courseToDelete) return
    
    const supabase = getSupabaseClient()
    const idNum = Number.parseInt(courseToDelete.id)
    
    try {
      console.log(`[DELETE COURSE] Starting deletion for course: ${courseToDelete.name}`)
      console.log(`[DELETE COURSE] Course ID as number: ${idNum}`)
      
      // Test database connection and table structure
      console.log(`[DELETE COURSE] Testing database connection...`)
      const { data: testData, error: testError } = await supabase
        .from("courses")
        .select("course_id, course_name")
        .limit(1)
      
      if (testError) {
        console.error("[DELETE COURSE] Database connection test failed:", testError)
        console.error("[DELETE COURSE] Test error details:", JSON.stringify(testError, null, 2))
      } else {
        console.log("[DELETE COURSE] Database connection test successful:", testData)
      }
      
      // Step 1: Check if course exists before deletion
      console.log(`[DELETE COURSE] Checking if course exists...`)
      const { data: courseExists, error: checkError } = await supabase
        .from("courses")
        .select("course_id, course_name")
        .eq("course_id", idNum)
      
      if (checkError) {
        console.error("[DELETE COURSE] Error checking course existence:", checkError)
        console.error("[DELETE COURSE] Check error details:", JSON.stringify(checkError, null, 2))
        return
      }
      
      if (!courseExists || courseExists.length === 0) {
        console.error("[DELETE COURSE] Course not found:", idNum)
        return
      }
      
      console.log(`[DELETE COURSE] Course found:`, courseExists[0])
      
      // Step 2: Check course_subjects relationships
      console.log(`[DELETE COURSE] Checking course-subject relationships...`)
      const { data: relationships, error: relError } = await supabase
        .from("course_subjects")
        .select("course_id, subject_id, position")
        .eq("course_id", idNum)
      
      if (relError) {
        console.error("[DELETE COURSE] Error checking relationships:", relError)
        console.error("[DELETE COURSE] Relationship error details:", JSON.stringify(relError, null, 2))
      } else {
        console.log(`[DELETE COURSE] Found ${relationships?.length || 0} course-subject relationships`)
      }
      
      // Step 3: Check subjects table references
      console.log(`[DELETE COURSE] Checking subjects table references...`)
      
      // First, let's see what columns the subjects table actually has
      const { data: subjectStructure, error: structureError } = await supabase
        .from("subjects")
        .select("*")
        .limit(1)
      
      let subjectRefs: any[] = []
      
      if (structureError) {
        console.error("[DELETE COURSE] Error checking subjects table structure:", structureError)
        console.error("[DELETE COURSE] Structure error details:", JSON.stringify(structureError, null, 2))
      } else if (subjectStructure && subjectStructure.length > 0) {
        console.log("[DELETE COURSE] Subjects table structure:", Object.keys(subjectStructure[0]))
        
        // Check if course_id column exists
        if ('course_id' in subjectStructure[0]) {
          console.log("[DELETE COURSE] course_id column found in subjects table")
          
          const { data: refs, error: subRefError } = await supabase
            .from("subjects")
            .select("subject_id, subject_name")
            .eq("course_id", idNum)
          
          if (subRefError) {
            console.error("[DELETE COURSE] Error checking subjects references:", subRefError)
            console.error("[DELETE COURSE] Subjects reference error details:", JSON.stringify(subRefError, null, 2))
          } else {
            subjectRefs = refs || []
            console.log(`[DELETE COURSE] Found ${subjectRefs.length} subjects referencing this course`)
          }
        } else {
          console.log("[DELETE COURSE] No course_id column found in subjects table")
          console.log("[DELETE COURSE] The relationship might be through course_subjects table only")
        }
      }
      
      // Step 4: Delete subjects table references first
      if (subjectRefs && subjectRefs.length > 0) {
        console.log(`[DELETE COURSE] Deleting subjects table references...`)
        
        // Test the subjects table structure first
        console.log(`[DELETE COURSE] Testing subjects table structure...`)
        const { data: testSubjects, error: testSubError } = await supabase
          .from("subjects")
          .select("*")
          .limit(1)
        
        if (testSubError) {
          console.error("[DELETE COURSE] Subjects table structure test failed:", testSubError)
          console.error("[DELETE COURSE] Test error details:", JSON.stringify(testSubError, null, 2))
        } else {
          console.log("[DELETE COURSE] Subjects table structure test successful:", testSubjects)
          console.log("[DELETE COURSE] Subjects table columns:", Object.keys(testSubjects[0] || {}))
        }
        
        // For each subject, we need to delete trainer_subjects first
        console.log(`[DELETE COURSE] Processing ${subjectRefs.length} subjects...`)
        
        for (const subject of subjectRefs) {
          const subjectId = subject.subject_id
          console.log(`[DELETE COURSE] Processing subject ID: ${subjectId}`)
          
          // Step 4a: Delete schedules for this subject
          console.log(`[DELETE COURSE] Deleting schedules for subject ${subjectId}...`)
          const { error: schedulesError } = await supabase
            .from("schedules")
            .delete()
            .eq("subject_id", subjectId)
          
          if (schedulesError) {
            console.error(`[DELETE COURSE] Error deleting schedules for subject ${subjectId}:`, schedulesError)
            console.error(`[DELETE COURSE] Error details:`, JSON.stringify(schedulesError, null, 2))
            return
          }
          
          console.log(`[DELETE COURSE] Schedules deleted for subject ${subjectId}`)
          
          // Step 4b: Delete trainer_subjects for this subject
          console.log(`[DELETE COURSE] Deleting trainer_subjects for subject ${subjectId}...`)
          const { error: trainerSubError } = await supabase
            .from("trainer_subjects")
            .delete()
            .eq("subject_id", subjectId)
          
          if (trainerSubError) {
            console.error(`[DELETE COURSE] Error deleting trainer_subjects for subject ${subjectId}:`, trainerSubError)
            console.error(`[DELETE COURSE] Error details:`, JSON.stringify(trainerSubError, null, 2))
            return
          }
          
          console.log(`[DELETE COURSE] Trainer subjects deleted for subject ${subjectId}`)
        }
        
        // Step 4c: Delete ALL course_subjects relationships that reference these subjects
        console.log(`[DELETE COURSE] Deleting ALL course_subjects relationships for these subjects...`)
        
        // First, let's see what course_subjects records exist for these subjects
        const subjectIds = subjectRefs.map(s => s.subject_id)
        console.log(`[DELETE COURSE] Subject IDs to check:`, subjectIds)
        
        const { data: allCourseSubjects, error: checkCourseSubError } = await supabase
          .from("course_subjects")
          .select("course_id, subject_id, position")
          .in("subject_id", subjectIds)
        
        if (checkCourseSubError) {
          console.error("[DELETE COURSE] Error checking course_subjects:", checkCourseSubError)
          console.error("[DELETE COURSE] Error details:", JSON.stringify(checkCourseSubError, null, 2))
        } else {
          console.log(`[DELETE COURSE] Found ${allCourseSubjects?.length || 0} course_subjects records for these subjects`)
          console.log(`[DELETE COURSE] Course subjects details:`, allCourseSubjects)
        }
        
        // Delete ALL course_subjects records for these subjects (not just for this course)
        const { error: courseSubDeleteError } = await supabase
          .from("course_subjects")
          .delete()
          .in("subject_id", subjectIds)
        
        if (courseSubDeleteError) {
          console.error("[DELETE COURSE] Error deleting course_subjects relationships:", courseSubDeleteError)
          console.error("[DELETE COURSE] Error details:", JSON.stringify(courseSubDeleteError, null, 2))
          return
        }
        
        console.log(`[DELETE COURSE] ALL course_subjects relationships deleted successfully`)
        
        // Now try to delete subjects with course_id
        console.log(`[DELETE COURSE] Attempting to delete subjects with course_id = ${idNum}`)
        const { error: subjectsDeleteError } = await supabase
          .from("subjects")
          .delete()
          .eq("course_id", idNum)
        
        if (subjectsDeleteError) {
          console.error("[DELETE COURSE] Error deleting subjects references:", subjectsDeleteError)
          console.error("[DELETE COURSE] Subjects delete error details:", JSON.stringify(subjectsDeleteError, null, 2))
          return
        }
        
        console.log(`[DELETE COURSE] Subjects references deleted successfully`)
      }
      
      // Step 5: Delete course_subjects relationships
      console.log(`[DELETE COURSE] Deleting course-subject relationships...`)
      const { error: subjectDeleteError } = await supabase
        .from("course_subjects")
        .delete()
        .eq("course_id", idNum)
      
      if (subjectDeleteError) {
        console.error("[DELETE COURSE] Error deleting course-subject relationships:", subjectDeleteError)
        console.error("[DELETE COURSE] Error details:", JSON.stringify(subjectDeleteError, null, 2))
        return
      }
      
      // Step 6: Delete the course
      console.log(`[DELETE COURSE] Deleting course...`)
      const { error: courseDeleteError } = await supabase
        .from("courses")
        .delete()
        .eq("course_id", idNum)
      
      if (courseDeleteError) {
        console.error("[DELETE COURSE] Error deleting course:", courseDeleteError)
        console.error("[DELETE COURSE] Error details:", JSON.stringify(courseDeleteError, null, 2))
        return
      }
      
      console.log(`[DELETE COURSE] Course deleted successfully`)
      
      // Update UI
      setCourses(courses.filter((c) => c.id !== courseToDelete.id))
      
      // Close dialog and reset state
      setDeleteConfirmOpen(false)
      setCourseToDelete(null)
      
    } catch (error: any) {
      console.error("[DELETE COURSE] Unexpected error:", error)
      console.error("[DELETE COURSE] Error details:", JSON.stringify(error, null, 2))
      console.error("[DELETE COURSE] Error type:", typeof error)
      console.error("[DELETE COURSE] Error constructor:", error?.constructor?.name)
      console.error("[DELETE COURSE] Error stack:", error?.stack)
    }
  }

  const handleUpdateCourse = async () => {
    if (!editingCourse) return
    const supabase = getSupabaseClient()
    const totalDuration = formData.subjects.reduce((sum, subjectId) => {
      const s = subjects.find((sub) => sub.id === subjectId)
      return sum + (s ? Number(s.duration || 0) : 0)
    }, 0)
    const payload = {
      course_name: formData.name,
      description: formData.description,
      duration_days: totalDuration,
    }
    const courseIdNum = Number.parseInt(editingCourse.id)
    const { error } = await supabase.from("courses").update(payload).eq("course_id", courseIdNum)
    if (error) {
      console.error("Failed to update course:", error)
      return
    }
    // Replace course_subjects rows with new order
    await supabase.from("course_subjects").delete().eq("course_id", courseIdNum)
    if (formData.subjects.length > 0) {
      const rows = formData.subjects.map((subjectId: string, idx: number) => ({
        course_id: courseIdNum,
        subject_id: Number.parseInt(subjectId),
        position: idx,
      }))
      const { error: csError } = await supabase.from("course_subjects").insert(rows)
      if (csError) {
        console.error("Failed to update course_subjects:", csError)
      }
    }
    const updatedCourses = courses.map((course) =>
      course.id === editingCourse.id ? { ...course, ...formData, duration: totalDuration } : course,
    )
    setCourses(updatedCourses)
    setEditingCourse(null)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      duration: 0,
      subjects: [],
    })
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
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-600">Manage your training programs and curricula</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary-gradient hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Course</DialogTitle>
            </DialogHeader>
            <CourseForm
              formData={formData}
              setFormData={setFormData}
              subjects={subjects}
              onSubmit={handleAddCourse}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCourses.map((course) => {
          const courseSubjects = getCourseSubjects(course)
          const courseBatches = getCourseBatches(course.id)
          const totalStudents = courseBatches.reduce((acc, batch) => acc + batch.currentStudents, 0)

          return (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{course.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{course.description}</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handleEditCourse(course)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Course</DialogTitle>
                      </DialogHeader>
                      <CourseForm
                        formData={formData}
                        setFormData={setFormData}
                        subjects={subjects}
                        onSubmit={handleUpdateCourse}
                        onCancel={() => setEditingCourse(null)}
                        isEditing
                      />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCourse(course)}
                  >
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-lg font-semibold">{course.duration}</div>
                    <div className="text-xs text-muted-foreground">Days</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-lg font-semibold">{courseSubjects.length}</div>
                    <div className="text-xs text-muted-foreground">Subjects</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Users className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-lg font-semibold">{totalStudents}</div>
                    <div className="text-xs text-muted-foreground">Students</div>
                  </div>
                </div>

                {/* Subjects */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Subjects</h4>
                  <div className="flex flex-wrap gap-2">
                    {courseSubjects.map((subject) => (
                      <Badge key={subject?.id} variant="secondary" className="text-xs">
                        {subject?.name} ({subject?.duration}d)
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Active Batches */}
                {courseBatches.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Active Batches</h4>
                    <div className="space-y-1">
                      {courseBatches.slice(0, 3).map((batch) => (
                        <div key={batch.id} className="flex items-center justify-between text-sm">
                          <span>{batch.name}</span>
                          <Badge variant="outline">{batch.status}</Badge>
                        </div>
                      ))}
                      {courseBatches.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{courseBatches.length - 3} more batches</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Delete Course</DialogTitle>
          </DialogHeader>
          
          {courseToDelete && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Are you sure you want to delete <span className="font-bold text-red-600">{courseToDelete.name}</span>?
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-yellow-800 font-medium mb-1">📚 Course Information</p>
                  <p className="text-sm text-yellow-700">
                    This course has <span className="font-bold">{courseToDelete.subjects.length}</span> subjects and lasts <span className="font-bold">{courseToDelete.duration}</span> days.
                  </p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-800 font-medium mb-1">⚠️ Warning</p>
                  <p className="text-sm text-red-700">
                    Deleting this course will also remove all course-subject relationships.
                  </p>
                </div>
                
                <p className="text-sm text-gray-600">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={performCourseDeletion}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  🗑️ Delete Course
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  ❌ Cancel
                </Button>
              </div>
              
              <div className="text-xs text-gray-500 text-center">
                <p><strong>Note:</strong> This will not affect existing batches or schedules.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

interface CourseFormProps {
  formData: any
  setFormData: (data: any) => void
  subjects: any[]
  onSubmit: () => void
  onCancel: () => void
  isEditing?: boolean
}

function CourseForm({ formData, setFormData, subjects, onSubmit, onCancel, isEditing }: CourseFormProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(formData.subjects || [])
  const [availableSubjects, setAvailableSubjects] = useState(subjects.filter((s) => !selectedSubjects.includes(s.id)))

  const addSubject = (subjectId: string) => {
    setSelectedSubjects([...selectedSubjects, subjectId])
    setAvailableSubjects(availableSubjects.filter((s) => s.id !== subjectId))
    setFormData({ ...formData, subjects: [...selectedSubjects, subjectId] })
  }

  const removeSubject = (subjectId: string) => {
    const newSelected = selectedSubjects.filter((id) => id !== subjectId)
    setSelectedSubjects(newSelected)
    const subject = subjects.find((s) => s.id === subjectId)
    if (subject) {
      setAvailableSubjects([...availableSubjects, subject])
    }
    setFormData({ ...formData, subjects: newSelected })
  }

  const moveSubject = (fromIndex: number, toIndex: number) => {
    const newOrder = [...selectedSubjects]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, moved)
    setSelectedSubjects(newOrder)
    setFormData({ ...formData, subjects: newOrder })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Course Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter course name"
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Course description"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="duration">Duration (days)</Label>
        <Input
          id="duration"
          type="number"
          min="1"
          max="365"
          value={formData.duration}
          disabled
          className="bg-gray-100 cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Total duration in working days (auto-calculated from subjects)
        </p>
      </div>

      <div>
        <Label>Course Curriculum (in order)</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Available Subjects */}
          <div>
            <h4 className="text-sm font-medium mb-2">Available Subjects</h4>
            <div className="border rounded-lg p-3 min-h-[200px] space-y-2">
              {availableSubjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => addSubject(subject.id)}
                >
                  <span className="text-sm">{subject.name}</span>
                  <Badge variant="outline">{subject.duration}d</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Subjects (Ordered) */}
          <div>
            <h4 className="text-sm font-medium mb-2">Course Curriculum</h4>
            <div className="border rounded-lg p-3 min-h-[200px] space-y-2">
              {selectedSubjects.map((subjectId, index) => {
                const subject = subjects.find((s) => s.id === subjectId)
                return (
                  <div
                    key={subjectId}
                    className="flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded"
                  >
                    <div className="flex items-center space-x-2">
                                              <span className="text-xs bg-primary text-white px-2 py-1 rounded">{index + 1}</span>
                      <span className="text-sm">{subject?.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{subject?.duration}d</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubject(subjectId)}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
                        <Button onClick={onSubmit} className="bg-primary-gradient hover:opacity-90">
          {isEditing ? "Update" : "Add"} Course
        </Button>
      </div>
    </div>
  )
}
