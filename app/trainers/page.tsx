"use client"

import { useState, useEffect } from "react"
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
import { Toast, useToast } from "../../components/ui/toast"

export default function TrainersPage() {
  const { trainers, subjects, setTrainers, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null)
  const [successMessage, setSuccessMessage] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [trainerToDelete, setTrainerToDelete] = useState<{ id: string, name: string, schedules: any[], leaves: any[] } | null>(null)
  const { toast, showToast, hideToast } = useToast()

  // Ensure form data is properly initialized
  useEffect(() => {
    if (!editingTrainer && !isAddDialogOpen && !isEditDialogOpen) {
      resetForm()
    }
  }, [editingTrainer, isAddDialogOpen, isEditDialogOpen])

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

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
    startTime: "09:00",
    endTime: "17:00",
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
      start_time: formData.startTime,
      end_time: formData.endTime,
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
      startTime: formData.startTime,
      endTime: formData.endTime,
      availability: formData.availability,
      leaves: [],
      status: "active",
    }
    setTrainers([...trainers, newTrainer])
    
    // Show success message and close dialog
    showSuccessMessage("Trainer added successfully!")
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
      startTime: trainer.startTime || "09:00",
      endTime: trainer.endTime || "17:00",
      availability: (trainer as any).availability && (trainer as any).availability.monday
        ? (trainer as any).availability
        : defaultAvailability,
    })
    setIsEditDialogOpen(true)
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
      start_time: formData.startTime,
      end_time: formData.endTime,
    }
    const trainerIdNum = Number.parseInt(editingTrainer.id)
    const { error } = await supabase.from("trainers").update(payload).eq("trainer_id", trainerIdNum)
    if (error) {
      console.error("Failed to update trainer:", error)
      return
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
      trainer.id === editingTrainer.id ? { 
        ...trainer, 
        ...formData,
        startTime: formData.startTime,
        endTime: formData.endTime
      } : trainer,
    )
    setTrainers(updatedTrainers)
    
    // Show success message and close dialog
    showSuccessMessage("Trainer updated successfully!")
    setEditingTrainer(null)
    setIsEditDialogOpen(false)
    resetForm()
  }

  const handleDeleteTrainer = async (trainerId: string) => {
    const supabase = getSupabaseClient()
    const idNum = Number.parseInt(trainerId)
    
    try {
      console.log(`[DELETE TRAINER] Starting deletion check for trainer ID: ${trainerId}`)
      console.log(`[DELETE TRAINER] Trainer ID as number: ${idNum}`)
      
      // Test query to check table structure
      console.log(`[DELETE TRAINER] Testing table structure...`)
      
      try {
        const { data: testData, error: testError } = await supabase
          .from("trainer_leaves")
          .select("*")
          .limit(1)
        
        console.log("[DELETE TRAINER] Table structure test result:", { data: testData, error: testError })
        
        if (testError) {
          console.error("[DELETE TRAINER] Table structure test failed:", testError)
          console.error("[DELETE TRAINER] Test error details:", JSON.stringify(testError, null, 2))
        } else {
          console.log("[DELETE TRAINER] Table structure test successful:", testData)
        }
      } catch (testException: any) {
        console.error("[DELETE TRAINER] Exception during table structure test:", testException)
        console.error("[DELETE TRAINER] Test exception details:", JSON.stringify(testException, null, 2))
      }
      
      // Step 1: Check if trainer has any associated schedules
      console.log(`[DELETE TRAINER] Checking for associated schedules...`)
      const { data: associatedSchedules, error: scheduleCheckError } = await supabase
        .from("schedules")
        .select("schedule_id, date, subject_id, batch_id")
        .eq("trainer_id", idNum)
      
      if (scheduleCheckError) {
        console.error("[DELETE TRAINER] Error checking schedules:", scheduleCheckError)
        console.error("[DELETE TRAINER] Error details:", JSON.stringify(scheduleCheckError, null, 2))
        showToast(`Failed to check trainer schedules: ${scheduleCheckError.message || 'Unknown error'}`, 'error')
        return
      }
      
      // Step 2: Check if trainer has any associated leaves
      console.log(`[DELETE TRAINER] Checking for associated leaves...`)
      
      let leavesData: any[] = []
      
      try {
        const { data: associatedLeaves, error: leaveCheckError } = await supabase
          .from("trainer_leaves")
          .select("trainer_id, leave_date, leave_type, reason, status")
          .eq("trainer_id", idNum)
        
        console.log("[DELETE TRAINER] Leaves query result:", { data: associatedLeaves, error: leaveCheckError })
        
        if (leaveCheckError) {
          console.error("[DELETE TRAINER] Error checking leaves:", leaveCheckError)
          console.error("[DELETE TRAINER] Error details:", JSON.stringify(leaveCheckError, null, 2))
          showToast(`Failed to check trainer leaves: ${leaveCheckError.message || 'Unknown error'}`, 'error')
          return
        }
        
        // Store the leaves data for later use
        leavesData = associatedLeaves || []
        console.log(`[DELETE TRAINER] Found ${leavesData.length} associated leaves`)
        
      } catch (leaveError: any) {
        console.error("[DELETE TRAINER] Exception during leaves check:", leaveError)
        console.error("[DELETE TRAINER] Exception details:", JSON.stringify(leaveError, null, 2))
        showToast(`Exception checking trainer leaves: ${leaveError?.message || 'Unknown exception'}`, 'error')
        return
      }
      
      // If we couldn't get leaves data, assume no leaves
      if (!leavesData) {
        console.log("[DELETE TRAINER] No leaves data available, assuming no leaves")
        leavesData = []
      }
      
      // If trainer has dependencies, show confirmation dialog
      if ((associatedSchedules && associatedSchedules.length > 0) || (leavesData && leavesData.length > 0)) {
        const trainer = trainers.find(t => t.id === trainerId)
        setTrainerToDelete({
          id: trainerId,
          name: trainer?.name || 'Unknown Trainer',
          schedules: associatedSchedules || [],
          leaves: leavesData || []
        })
        setDeleteConfirmOpen(true)
        return
      }
      
      // No dependencies, proceed with deletion
      await performTrainerDeletion(trainerId, idNum)
      
    } catch (error: any) {
      console.error("[DELETE TRAINER] Unexpected error:", error)
      showToast(`Failed to check trainer dependencies: ${error?.message || "Unknown error occurred"}`, 'error')
    }
    }
  
  const performTrainerDeletion = async (trainerId: string, idNum: number) => {
    const supabase = getSupabaseClient()
    
    try {
      console.log(`[DELETE TRAINER] Performing deletion for trainer ID: ${trainerId}`)
      
      // Step 1: Delete trainer-subject relationships
      console.log(`[DELETE TRAINER] Deleting trainer-subject relationships...`)
      const { error: subjectDeleteError } = await supabase
        .from("trainer_subjects")
        .delete()
        .eq("trainer_id", idNum)
      
      if (subjectDeleteError) {
        console.error("[DELETE TRAINER] Error deleting trainer-subject relationships:", subjectDeleteError)
        showToast(`Failed to delete trainer-subject relationships: ${subjectDeleteError.message}`, 'error')
        return
      }
      
      // Step 2: Delete the trainer
      console.log(`[DELETE TRAINER] Deleting trainer...`)
      const { error: trainerDeleteError } = await supabase
        .from("trainers")
        .delete()
        .eq("trainer_id", idNum)
      
      if (trainerDeleteError) {
        console.error("[DELETE TRAINER] Error deleting trainer:", trainerDeleteError)
        showToast(`Failed to delete trainer: ${trainerDeleteError.message}`, 'error')
        return
      }
      
      console.log(`[DELETE TRAINER] Trainer deleted successfully`)
      
      // Show success message
      showToast("Trainer deleted successfully! 🎉", 'success')
      setTrainers(trainers.filter((t) => t.id !== trainerId))
      
    } catch (error: any) {
      console.error("[DELETE TRAINER] Unexpected error during deletion:", error)
      showToast(`Failed to delete trainer: ${error?.message || "Unknown error occurred"}`, 'error')
    }
  }
  
  const handleForceDelete = async () => {
    if (!trainerToDelete) return
    
    const supabase = getSupabaseClient()
    const idNum = Number.parseInt(trainerToDelete.id)
    
    try {
      console.log(`[FORCE DELETE] Starting force deletion for trainer: ${trainerToDelete.name}`)
      
      // Step 1: Delete all associated schedules
      if (trainerToDelete.schedules.length > 0) {
        console.log(`[FORCE DELETE] Deleting ${trainerToDelete.schedules.length} schedules...`)
        const { error: scheduleDeleteError } = await supabase
          .from("schedules")
          .delete()
          .eq("trainer_id", idNum)
        
        if (scheduleDeleteError) {
          console.error("[FORCE DELETE] Error deleting schedules:", scheduleDeleteError)
          showToast(`Failed to delete schedules: ${scheduleDeleteError.message}`, 'error')
          return
        }
      }
      
      // Step 2: Delete all associated leaves
      if (trainerToDelete.leaves.length > 0) {
        console.log(`[FORCE DELETE] Deleting ${trainerToDelete.leaves.length} leaves...`)
        const { error: leaveDeleteError } = await supabase
          .from("trainer_leaves")
          .delete()
          .eq("trainer_id", idNum)
        
        if (leaveDeleteError) {
          console.error("[FORCE DELETE] Error deleting leaves:", leaveDeleteError)
          showToast(`Failed to delete leaves: ${leaveDeleteError.message}`, 'error')
          return
        }
      }
      
      // Step 3: Delete trainer-subject relationships
      console.log(`[FORCE DELETE] Deleting trainer-subject relationships...`)
      const { error: subjectDeleteError } = await supabase
        .from("trainer_subjects")
        .delete()
        .eq("trainer_id", idNum)
      
      if (subjectDeleteError) {
        console.error("[FORCE DELETE] Error deleting trainer-subject relationships:", subjectDeleteError)
        showToast(`Failed to delete trainer-subject relationships: ${subjectDeleteError.message}`, 'error')
        return
      }
      
      // Step 4: Delete the trainer
      console.log(`[FORCE DELETE] Deleting trainer...`)
      const { error: trainerDeleteError } = await supabase
        .from("trainers")
        .delete()
        .eq("trainer_id", idNum)
      
      if (trainerDeleteError) {
        console.error("[FORCE DELETE] Error deleting trainer:", trainerDeleteError)
        showToast(`Failed to delete trainer: ${trainerDeleteError.message}`, 'error')
        return
      }
      
      console.log(`[FORCE DELETE] Trainer and all dependencies deleted successfully`)
      
      // Show success message
      showToast(`Trainer "${trainerToDelete.name}" and all dependencies deleted successfully! 🗑️`, 'success')
      setTrainers(trainers.filter((t) => t.id !== trainerToDelete.id))
      
      // Close dialog and reset state
      setDeleteConfirmOpen(false)
      setTrainerToDelete(null)
      
    } catch (error: any) {
      console.error("[FORCE DELETE] Unexpected error:", error)
      showToast(`Failed to force delete trainer: ${error?.message || "Unknown error occurred"}`, 'error')
    }
  }
  
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      locations: [],
      expertise: [],
      priority: "Junior",
      timeSlots: [],
      startTime: "09:00",
      endTime: "17:00",
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

      {/* Success Message */}
      {showSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

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
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                        onCancel={() => {
                          setEditingTrainer(null)
                          setIsEditDialogOpen(false)
                        }}
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

              {/* Daily Working Hours */}
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-muted-foreground">
                  Daily: {trainer.startTime || "09:00"} - {trainer.endTime || "17:00"}
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
      
      {/* Beautiful Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Delete Trainer</DialogTitle>
          </DialogHeader>
          
          {trainerToDelete && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Are you sure you want to delete <span className="font-bold text-red-600">{trainerToDelete.name}</span>?
                </p>
                
                {trainerToDelete.schedules.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-yellow-800 font-medium mb-1">📅 Scheduled Sessions</p>
                    <p className="text-sm text-yellow-700">
                      This trainer has <span className="font-bold">{trainerToDelete.schedules.length}</span> scheduled sessions.
                    </p>
                  </div>
                )}
                
                {trainerToDelete.leaves.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-blue-800 font-medium mb-1">🏖️ Leave Records</p>
                    <p className="text-sm text-blue-700">
                      This trainer has <span className="font-bold">{trainerToDelete.leaves.length}</span> leave records.
                    </p>
                  </div>
                )}
                
                <p className="text-sm text-gray-600">
                  Choose an action to proceed:
                </p>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={handleForceDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  🗑️ Force Delete Everything
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  ❌ Cancel
                </Button>
              </div>
              
              <div className="text-xs text-gray-500 text-center">
                <p><strong>Force Delete</strong> will remove the trainer and ALL associated data permanently.</p>
                <p>This action cannot be undone.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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

      {/* Daily Working Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Daily Start Time</Label>
          <Input
            id="startTime"
            type="time"
            value={formData.startTime || "09:00"}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="endTime">Daily End Time</Label>
          <Input
            id="endTime"
            type="time"
            value={formData.endTime || "17:00"}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
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
