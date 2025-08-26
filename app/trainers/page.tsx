"use client"

import { useState } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Badge } from "../../components/ui/badge"
import { PriorityBadge } from "../../components/ui/priority-badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Checkbox } from "../../components/ui/checkbox"
import { Plus, Search, Edit, MapPin, Clock, BookOpen } from "lucide-react"
import type { Trainer } from "../../hooks/useData"
import { getSupabaseClient } from "../../lib/supabaseClient"

export default function TrainersPage() {
  const { trainers, subjects, setTrainers, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null)

  const defaultAvailability = {
    monday: { start: "09:00", end: "17:00" },
    tuesday: { start: "09:00", end: "17:00" },
    wednesday: { start: "09:00", end: "17:00" },
    thursday: { start: "09:00", end: "17:00" },
    friday: { start: "09:00", end: "17:00" },
  } as const

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    locations: [] as string[],
    expertise: [] as string[],
    priority: "Junior" as "Senior" | "Core" | "Junior",
    timeSlots: [] as string[],
    availability: {
      monday: { start: "09:00", end: "17:00" },
      tuesday: { start: "09:00", end: "17:00" },
      wednesday: { start: "09:00", end: "17:00" },
      thursday: { start: "09:00", end: "17:00" },
      friday: { start: "09:00", end: "17:00" },
    },
  })

  const filteredTrainers = trainers.filter(
    (trainer) =>
      trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trainer.expertise.some((exp) => exp.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleAddTrainer = async () => {
    const supabase = getSupabaseClient()
    const primaryLocation = formData.locations[0] ?? ""
    const priorityLevel = formData.priority === "Senior" ? 1 : formData.priority === "Core" ? 2 : 3
    const insertPayload = {
      name: formData.name,
      email: formData.email,
      location: primaryLocation,
      priority_level: priorityLevel,
      status: "active",
    }
    const { data, error } = await supabase.from("trainers").insert(insertPayload).select("*").single()
    if (error) {
      console.error("Failed to add trainer:", error)
      return
    }

    // Insert trainer_subjects based on selected expertise (names -> subject ids)
    const subjectNameToId = new Map(subjects.map((s) => [s.name, s.id]))
    const tsRows = formData.expertise
      .map((name: string) => subjectNameToId.get(name))
      .filter(Boolean)
      .map((subjectId: any) => ({
        trainer_id: Number(data.trainer_id ?? data.id),
        subject_id: Number(subjectId),
        experience_years: 2,
        proficiency_level: "expert",
      }))
    if (tsRows.length > 0) {
      const { error: tsError } = await supabase.from("trainer_subjects").insert(tsRows)
      if (tsError) console.error("trainer_subjects insert failed:", tsError)
    }

    const newTrainer: Trainer = {
      id: String(data.trainer_id ?? data.id),
      name: data.name,
      email: data.email ?? "",
      locations: formData.locations,
      expertise: formData.expertise,
      priority: formData.priority,
      timeSlots: formData.timeSlots,
      availability: formData.availability,
      leaves: [],
      status: "active",
    }
    setTrainers([...trainers, newTrainer])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditTrainer = (trainer: Trainer) => {
    setEditingTrainer(trainer)
    setFormData({
      name: trainer.name,
      email: trainer.email,
      locations: trainer.locations,
      expertise: trainer.expertise,
      priority: trainer.priority,
      timeSlots: trainer.timeSlots || [],
      availability: (trainer as any).availability && (trainer as any).availability.monday
        ? (trainer as any).availability
        : defaultAvailability,
    })
  }

  const handleUpdateTrainer = async () => {
    if (!editingTrainer) return
    const supabase = getSupabaseClient()
    const primaryLocation = formData.locations[0] ?? ""
    const priorityLevel = formData.priority === "Senior" ? 1 : formData.priority === "Core" ? 2 : 3
    const payload = {
      name: formData.name,
      email: formData.email,
      location: primaryLocation,
      priority_level: priorityLevel,
      status: "active",
    }
    const trainerIdNum = Number.parseInt(editingTrainer.id)
    const { error } = await supabase.from("trainers").update(payload).eq("trainer_id", trainerIdNum)
    if (error) {
      console.error("Failed to update trainer:", error)
    }

    // Sync trainer_subjects: delete then insert new
    await supabase.from("trainer_subjects").delete().eq("trainer_id", trainerIdNum)
    const subjectNameToId = new Map(subjects.map((s) => [s.name, s.id]))
    const tsRows = formData.expertise
      .map((name: string) => subjectNameToId.get(name))
      .filter(Boolean)
      .map((subjectId: any) => ({
        trainer_id: trainerIdNum,
        subject_id: Number(subjectId),
        experience_years: 2,
        proficiency_level: "expert",
      }))
    if (tsRows.length > 0) {
      const { error: tsError } = await supabase.from("trainer_subjects").insert(tsRows)
      if (tsError) console.error("trainer_subjects update failed:", tsError)
    }

    const updatedTrainers = trainers.map((trainer) =>
      trainer.id === editingTrainer.id ? { ...trainer, ...formData } : trainer,
    )
    setTrainers(updatedTrainers)
    setEditingTrainer(null)
    resetForm()
  }

  const handleDeleteTrainer = async (trainerId: string) => {
    const supabase = getSupabaseClient()
    const idNum = Number.parseInt(trainerId)
    await supabase.from("trainer_subjects").delete().eq("trainer_id", idNum)
    const { error } = await supabase.from("trainers").delete().eq("trainer_id", idNum)
    if (error) {
      console.error("Failed to delete trainer:", error)
      return
    }
    setTrainers(trainers.filter((t) => t.id !== trainerId))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      locations: [],
      expertise: [],
      priority: "Junior",
      timeSlots: [],
      availability: {
        monday: { start: "09:00", end: "17:00" },
        tuesday: { start: "09:00", end: "17:00" },
        wednesday: { start: "09:00", end: "17:00" },
        thursday: { start: "09:00", end: "17:00" },
        friday: { start: "09:00", end: "17:00" },
      },
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
          <h1 className="text-2xl font-bold text-gray-900">Trainers</h1>
          <p className="text-gray-600">Manage your training team and their expertise</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Trainer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Trainer</DialogTitle>
            </DialogHeader>
            <TrainerForm
              formData={formData}
              setFormData={setFormData}
              subjects={subjects}
              onSubmit={handleAddTrainer}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search trainers by name or expertise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trainers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTrainers.map((trainer) => (
          <Card key={trainer.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{trainer.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{trainer.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <PriorityBadge priority={trainer.priority} />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handleEditTrainer(trainer)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Trainer</DialogTitle>
                      </DialogHeader>
                      <TrainerForm
                        formData={formData}
                        setFormData={setFormData}
                        subjects={subjects}
                        onSubmit={handleUpdateTrainer}
                        onCancel={() => setEditingTrainer(null)}
                        isEditing
                      />
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteTrainer(trainer.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Locations */}
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {trainer.locations.map((location) => (
                    <Badge key={location} variant="outline" className="text-xs">
                      {location === "online"
                        ? "🌐 Online"
                        : location === "kochi"
                          ? "📍 Kochi"
                          : location === "calicut"
                            ? "📍 Calicut"
                            : location}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Expertise */}
              <div className="flex items-start space-x-2">
                <BookOpen className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {trainer.expertise.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              {trainer.timeSlots && trainer.timeSlots.length > 0 && (
                <div className="flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {trainer.timeSlots.map((slot) => (
                      <Badge key={slot} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {slot}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Availability */}
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-muted-foreground">
                  {((trainer as any).availability?.monday?.start ?? "09:00")} - {((trainer as any).availability?.monday?.end ?? "17:00")}
                </span>
              </div>

              {/* Leave Status */}
              {trainer.leaves.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-orange-600">
                    {trainer.leaves.filter((leave) => leave.status === "approved").length} approved leaves
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  )
}

interface TrainerFormProps {
  formData: any
  setFormData: (data: any) => void
  subjects: any[]
  onSubmit: () => void
  onCancel: () => void
  isEditing?: boolean
}

function TrainerForm({ formData, setFormData, subjects, onSubmit, onCancel, isEditing }: TrainerFormProps) {
  const locationOptions = [
    { value: "online", label: "🌐 Online" },
    { value: "kochi", label: "📍 Kochi" },
    { value: "calicut", label: "📍 Calicut" },
  ]

  const timeSlotOptions = [
    { value: "09:00-12:00", label: "Morning (9:00 AM - 12:00 PM)" },
    { value: "14:00-17:00", label: "Afternoon (2:00 PM - 5:00 PM)" },
    { value: "18:00-21:00", label: "Evening (6:00 PM - 9:00 PM)" },
    { value: "10:00-13:00", label: "Late Morning (10:00 AM - 1:00 PM)" },
    { value: "15:00-18:00", label: "Late Afternoon (3:00 PM - 6:00 PM)" },
  ]

  const handleExpertiseToggle = (subjectName: string) => {
    const updatedExpertise = formData.expertise.includes(subjectName)
      ? formData.expertise.filter((exp: string) => exp !== subjectName)
      : [...formData.expertise, subjectName]
    setFormData({ ...formData, expertise: updatedExpertise })
  }

  const handleLocationToggle = (location: string) => {
    const updatedLocations = formData.locations.includes(location)
      ? formData.locations.filter((loc: string) => loc !== location)
      : [...formData.locations, location]
    setFormData({ ...formData, locations: updatedLocations })
  }

  const handleTimeSlotToggle = (timeSlot: string) => {
    const updatedTimeSlots = formData.timeSlots.includes(timeSlot)
      ? formData.timeSlots.filter((slot: string) => slot !== timeSlot)
      : [...formData.timeSlots, timeSlot]
    setFormData({ ...formData, timeSlots: updatedTimeSlots })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter trainer name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="trainer@company.com"
          />
        </div>
      </div>

      {/* Locations */}
      <div>
        <Label>Locations</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {locationOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`location-${option.value}`}
                checked={formData.locations.includes(option.value)}
                onCheckedChange={() => handleLocationToggle(option.value)}
              />
              <Label htmlFor={`location-${option.value}`} className="text-sm">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Expertise */}
      <div>
        <Label>Expertise (Select from subjects)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded p-2">
          {subjects.map((subject) => (
            <div key={subject.id} className="flex items-center space-x-2">
              <Checkbox
                id={`expertise-${subject.id}`}
                checked={formData.expertise.includes(subject.name)}
                onCheckedChange={() => handleExpertiseToggle(subject.name)}
              />
              <Label htmlFor={`expertise-${subject.id}`} className="text-sm">
                {subject.name}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Select subjects this trainer can teach</p>
      </div>

      {/* Time Slots */}
      {formData.locations.includes("online") && (
        <div>
          <Label>Available Time Slots (for Online Training)</Label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {timeSlotOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`timeslot-${option.value}`}
                  checked={formData.timeSlots.includes(option.value)}
                  onCheckedChange={() => handleTimeSlotToggle(option.value)}
                />
                <Label htmlFor={`timeslot-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Select time slots when this trainer is available for online sessions
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="priority">Priority Level</Label>
        <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Senior">🥇 Senior</SelectItem>
            <SelectItem value="Core">🥈 Core</SelectItem>
            <SelectItem value="Junior">🥉 Junior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isEditing ? "Update" : "Add"} Trainer
        </Button>
      </div>
    </div>
  )
}
