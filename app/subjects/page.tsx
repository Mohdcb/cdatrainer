"use client"

import { useState } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Plus, Search, Edit, Clock } from "lucide-react"
import type { Subject } from "../../hooks/useData"
import { getSupabaseClient } from "../../lib/supabaseClient"

export default function SubjectsPage() {
  const { subjects, courses, setSubjects, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    duration: 0,
  })

  const filteredSubjects = subjects.filter((subject) => subject.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleAddSubject = async () => {
    const supabase = getSupabaseClient()
    const insertPayload = {
      subject_name: formData.name,
      duration_days: formData.duration,
    }
    const { data, error } = await supabase.from("subjects").insert(insertPayload).select("*").single()
    if (error) {
      console.error("Failed to add subject:", error)
      return
    }
    const newSubject: Subject = {
      id: String(data.subject_id ?? data.id),
      name: data.subject_name ?? formData.name,
      duration: Number(data.duration_days ?? formData.duration),
    }
    setSubjects([...subjects, newSubject])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      duration: subject.duration,
    })
  }

  const handleUpdateSubject = async () => {
    if (!editingSubject) return
    const supabase = getSupabaseClient()
    const payload = {
      subject_name: formData.name,
      duration_days: formData.duration,
    }
    const subjectIdNum = Number.parseInt(editingSubject.id)
    const { error } = await supabase.from("subjects").update(payload).eq("subject_id", subjectIdNum)
    if (error) {
      console.error("Failed to update subject:", error)
      return
    }
    const updatedSubjects = subjects.map((subject) =>
      subject.id === editingSubject.id ? { ...subject, ...formData } : subject,
    )
    setSubjects(updatedSubjects)
    setEditingSubject(null)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: "",
      duration: 0,
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
                    />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const supabase = getSupabaseClient()
                    const idNum = Number.parseInt(subject.id)
                    const { error } = await supabase.from("subjects").delete().eq("subject_id", idNum)
                    if (error) {
                      console.error("Failed to delete subject:", error)
                      return
                    }
                    setSubjects(subjects.filter((s) => s.id !== subject.id))
                  }}
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
    </MainLayout>
  )
}

interface SubjectFormProps {
  formData: any
  setFormData: (data: any) => void
  onSubmit: () => void
  onCancel: () => void
  isEditing?: boolean
}

function SubjectForm({ formData, setFormData, onSubmit, onCancel, isEditing }: SubjectFormProps) {
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
