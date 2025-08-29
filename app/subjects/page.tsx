"use client"

import { useState } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Plus, Search, Edit, Clock } from "lucide-react"
import type { Subject } from "../../hooks/useData"
import { getSupabaseClient } from "../../lib/supabaseClient"

export default function SubjectsPage() {
  const { subjects, courses, setSubjects, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    duration: 0,
    courseId: "",
  })

  const filteredSubjects = subjects.filter((subject) => subject.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleAddSubject = async () => {
    const supabase = getSupabaseClient()
    
    try {
      console.log(`[ADD SUBJECT] Starting subject addition...`)
      console.log(`[ADD SUBJECT] Form data:`, formData)
      
      // Validate required fields
      if (!formData.courseId) {
        console.error("[ADD SUBJECT] Course ID is required")
        alert("Please select a course for this subject")
        return
      }
      
      const insertPayload = {
        subject_name: formData.name,
        duration_days: formData.duration,
        course_id: Number.parseInt(formData.courseId),
      }
      
      console.log(`[ADD SUBJECT] Insert payload:`, insertPayload)
      
      // Test database connection first
      console.log(`[ADD SUBJECT] Testing database connection...`)
      const { data: testData, error: testError } = await supabase
        .from("subjects")
        .select("*")
        .limit(1)
      
      if (testError) {
        console.error("[ADD SUBJECT] Database connection test failed:", testError)
        console.error("[ADD SUBJECT] Test error details:", JSON.stringify(testError, null, 2))
      } else {
        console.log("[ADD SUBJECT] Database connection test successful:", testData)
        console.log("[ADD SUBJECT] Subjects table structure:", Object.keys(testData[0] || {}))
      }
      
      // Attempt to insert the subject
      console.log(`[ADD SUBJECT] Attempting to insert subject...`)
      const { data, error } = await supabase.from("subjects").insert(insertPayload).select("*").single()
      
      if (error) {
        console.error("[ADD SUBJECT] Failed to add subject:", error)
        console.error("[ADD SUBJECT] Error details:", JSON.stringify(error, null, 2))
        console.error("[ADD SUBJECT] Error code:", error.code)
        console.error("[ADD SUBJECT] Error message:", error.message)
        return
      }
      
      console.log(`[ADD SUBJECT] Subject inserted successfully:`, data)
      
      const newSubject: Subject = {
        id: String(data.subject_id ?? data.id),
        name: data.subject_name ?? formData.name,
        duration: Number(data.duration_days ?? formData.duration),
      }
      
      console.log(`[ADD SUBJECT] Created new subject object:`, newSubject)
      
      setSubjects([...subjects, newSubject])
      setIsAddDialogOpen(false)
      resetForm()
      
      console.log(`[ADD SUBJECT] Subject addition completed successfully`)
      
    } catch (error: any) {
      console.error("[ADD SUBJECT] Unexpected error:", error)
      console.error("[ADD SUBJECT] Error details:", JSON.stringify(error, null, 2))
      console.error("[ADD SUBJECT] Error type:", typeof error)
      console.error("[ADD SUBJECT] Error constructor:", error?.constructor?.name)
      console.error("[ADD SUBJECT] Error stack:", error?.stack)
    }
  }

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      duration: subject.duration,
      courseId: subject.courseId || "",
    })
  }

  const handleUpdateSubject = async () => {
    if (!editingSubject) return
    
    try {
      console.log(`[UPDATE SUBJECT] Starting subject update...`)
      console.log(`[UPDATE SUBJECT] Editing subject:`, editingSubject)
      console.log(`[UPDATE SUBJECT] New form data:`, formData)
      
      const supabase = getSupabaseClient()
      const payload = {
        subject_name: formData.name,
        duration_days: formData.duration,
        course_id: Number.parseInt(formData.courseId),
      }
      
      console.log(`[UPDATE SUBJECT] Update payload:`, payload)
      
      const subjectIdNum = Number.parseInt(editingSubject.id)
      console.log(`[UPDATE SUBJECT] Subject ID as number:`, subjectIdNum)
      
      const { error } = await supabase.from("subjects").update(payload).eq("subject_id", subjectIdNum)
      
      if (error) {
        console.error("[UPDATE SUBJECT] Failed to update subject:", error)
        console.error("[UPDATE SUBJECT] Error details:", JSON.stringify(error, null, 2))
        console.error("[UPDATE SUBJECT] Error code:", error.code)
        console.error("[UPDATE SUBJECT] Error message:", error.message)
        return
      }
      
      console.log(`[UPDATE SUBJECT] Subject updated successfully`)
      
      const updatedSubjects = subjects.map((subject) =>
        subject.id === editingSubject.id ? { ...subject, ...formData } : subject,
      )
      
      setSubjects(updatedSubjects)
      setEditingSubject(null)
      resetForm()
      
      console.log(`[UPDATE SUBJECT] Subject update completed successfully`)
      
    } catch (error: any) {
      console.error("[UPDATE SUBJECT] Unexpected error:", error)
      console.error("[UPDATE SUBJECT] Error details:", JSON.stringify(error, null, 2))
      console.error("[UPDATE SUBJECT] Error type:", typeof error)
      console.error("[UPDATE SUBJECT] Error constructor:", error?.constructor?.name)
      console.error("[UPDATE SUBJECT] Error stack:", error?.stack)
    }
  }

  const handleDeleteSubject = (subject: Subject) => {
    setSubjectToDelete(subject)
    setDeleteConfirmOpen(true)
  }

  const performSubjectDeletion = async () => {
    if (!subjectToDelete) return
    
    const supabase = getSupabaseClient()
    const idNum = Number.parseInt(subjectToDelete.id)
    
    try {
      console.log(`[DELETE SUBJECT] Starting deletion for subject: ${subjectToDelete.name}`)
      
      // Check if subject is used in any courses
      const { data: courseUsage, error: usageError } = await supabase
        .from("course_subjects")
        .select("course_id")
        .eq("subject_id", idNum)
      
      if (usageError) {
        console.error("[DELETE SUBJECT] Error checking course usage:", usageError)
        console.error("[DELETE SUBJECT] Error details:", JSON.stringify(usageError, null, 2))
        return
      }
      
      if (courseUsage && courseUsage.length > 0) {
        console.log(`[DELETE SUBJECT] Subject is used in ${courseUsage.length} courses`)
        // For now, we'll just log this. In a real app, you might want to prevent deletion
        // or show a different message
      }
      
      // Check if subject is used by any trainers
      const { data: trainerUsage, error: trainerError } = await supabase
        .from("trainer_subjects")
        .select("trainer_id")
        .eq("subject_id", idNum)
      
      if (trainerError) {
        console.error("[DELETE SUBJECT] Error checking trainer usage:", trainerError)
        console.error("[DELETE SUBJECT] Error details:", JSON.stringify(trainerError, null, 2))
        return
      }
      
      if (trainerUsage && trainerUsage.length > 0) {
        console.log(`[DELETE SUBJECT] Subject is used by ${trainerUsage.length} trainers`)
      }
      
      // Delete the subject
      console.log(`[DELETE SUBJECT] Deleting subject...`)
      const { error: deleteError } = await supabase
        .from("subjects")
        .delete()
        .eq("subject_id", idNum)
      
      if (deleteError) {
        console.error("[DELETE SUBJECT] Error deleting subject:", deleteError)
        console.error("[DELETE SUBJECT] Error details:", JSON.stringify(deleteError, null, 2))
        return
      }
      
      console.log(`[DELETE SUBJECT] Subject deleted successfully`)
      
      // Update UI
      setSubjects(subjects.filter((s) => s.id !== subjectToDelete.id))
      
      // Close dialog and reset state
      setDeleteConfirmOpen(false)
      setSubjectToDelete(null)
      
    } catch (error: any) {
      console.error("[DELETE SUBJECT] Unexpected error:", error)
      console.error("[DELETE SUBJECT] Error details:", JSON.stringify(error, null, 2))
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      duration: 0,
      courseId: "",
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
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="text-gray-600">Manage individual course subjects and their durations</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary-gradient hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
            </DialogHeader>
            <SubjectForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAddSubject}
              onCancel={() => setIsAddDialogOpen(false)}
              courses={courses}
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
              placeholder="Search subjects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSubjects.map((subject) => (
          <Card key={subject.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{subject.name}</CardTitle>
                  <div className="flex items-center mt-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    {subject.duration} day{subject.duration !== 1 ? "s" : ""}
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => handleEditSubject(subject)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Subject</DialogTitle>
                    </DialogHeader>
                    <SubjectForm
                      formData={formData}
                      setFormData={setFormData}
                      onSubmit={handleUpdateSubject}
                      onCancel={() => setEditingSubject(null)}
                      isEditing
                      courses={courses}
                    />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteSubject(subject)}
                >
                  Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{subject.duration}</div>
                <div className="text-sm text-muted-foreground">Day Duration</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Delete Subject</DialogTitle>
          </DialogHeader>
          
          {subjectToDelete && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Are you sure you want to delete <span className="font-bold text-red-600">{subjectToDelete.name}</span>?
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-yellow-800 font-medium mb-1">📚 Subject Information</p>
                  <p className="text-sm text-yellow-700">
                    This subject has a duration of <span className="font-bold">{subjectToDelete.duration}</span> days.
                  </p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-800 font-medium mb-1">⚠️ Warning</p>
                  <p className="text-sm text-red-700">
                    Deleting this subject will remove it from all courses and trainer expertise.
                  </p>
                </div>
                
                <p className="text-sm text-gray-600">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={performSubjectDeletion}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  🗑️ Delete Subject
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  ❌ Cancel
                </Button>
              </div>
              
              <div className="text-xs text-gray-500 text-center">
                <p><strong>Note:</strong> This will affect courses and trainers that use this subject.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

interface SubjectFormProps {
  formData: any
  setFormData: (data: any) => void
  onSubmit: () => void
  onCancel: () => void
  isEditing?: boolean
  courses: any[]
}

function SubjectForm({ formData, setFormData, onSubmit, onCancel, isEditing, courses }: SubjectFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Subject Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter subject name"
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
          onChange={(e) => setFormData({ ...formData, duration: Math.max(1, Number.parseInt(e.target.value) || 1) })}
          placeholder="5"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Duration in working days for this subject
        </p>
      </div>

      <div>
        <Label htmlFor="courseId">Course</Label>
        <Select value={formData.courseId} onValueChange={(value) => setFormData({ ...formData, courseId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Select the course this subject belongs to
        </p>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} className="bg-primary-gradient hover:opacity-90">
          {isEditing ? "Update" : "Add"} Subject
        </Button>
      </div>
    </div>
  )
}
