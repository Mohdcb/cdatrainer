"use client"

import { useState } from "react"
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

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration: 0,
    subjects: [] as string[],
  })

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
                    onClick={async () => {
                      const supabase = getSupabaseClient()
                      const idNum = Number.parseInt(course.id)
                      const { error } = await supabase.from("courses").delete().eq("course_id", idNum)
                      if (error) {
                        console.error("Failed to delete course:", error)
                        return
                      }
                      setCourses(courses.filter((c) => c.id !== course.id))
                    }}
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
                    <div className="text-xs text-muted-foreground">Weeks</div>
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
                        {subject?.name} ({subject?.duration}w)
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
        <Label htmlFor="duration">Duration (weeks)</Label>
        <Input
          id="duration"
          type="number"
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: Number.parseInt(e.target.value) || 0 })}
          placeholder="12"
        />
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
                  <Badge variant="outline">{subject.duration}w</Badge>
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
                      <Badge variant="outline">{subject?.duration}w</Badge>
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
