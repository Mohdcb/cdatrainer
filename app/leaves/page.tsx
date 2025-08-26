"use client"

import { useState } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { StatusBadge } from "../../components/ui/status-badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Textarea } from "../../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Plus, Search, Calendar, Clock, User, CheckCircle, XCircle } from "lucide-react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import type { Trainer, Holiday } from "../../hooks/useData"

interface LeaveRequest {
  id: string
  trainerId: string
  startDate: string
  endDate: string
  reason: string
  status: "pending" | "approved" | "rejected"
  requestDate: string
  approvedBy?: string
  notes?: string
}

export default function LeavesPage() {
  const { trainers, holidays, setTrainers, setHolidays, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState("requests")

  // Mock leave requests - in real app this would come from API
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: "lr1",
      trainerId: "t1",
      startDate: "2024-01-15",
      endDate: "2024-01-19",
      reason: "Vacation",
      status: "approved",
      requestDate: "2024-01-01",
      approvedBy: "Admin",
    },
    {
      id: "lr2",
      trainerId: "t2",
      startDate: "2024-02-05",
      endDate: "2024-02-09",
      reason: "Conference",
      status: "pending",
      requestDate: "2024-01-20",
    },
    {
      id: "lr3",
      trainerId: "t4",
      startDate: "2024-03-10",
      endDate: "2024-03-12",
      reason: "Personal",
      status: "pending",
      requestDate: "2024-02-15",
    },
  ])

  const [leaveFormData, setLeaveFormData] = useState({
    trainerId: "",
    startDate: "",
    endDate: "",
    reason: "",
  })

  const [holidayFormData, setHolidayFormData] = useState({
    date: "",
    name: "",
  })

  const filteredRequests = leaveRequests.filter((request) => {
    const trainer = trainers.find((t) => t.id === request.trainerId)
    return trainer?.name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const filteredHolidays = holidays.filter((holiday) => holiday.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleSubmitLeaveRequest = async () => {
    const supabase = getSupabaseClient()
    const trainerIdNum = Number.parseInt(leaveFormData.trainerId)
    const insertPayload = {
      trainer_id: trainerIdNum,
      leave_date: leaveFormData.startDate, // simplifying: single-day leave
      leave_type: "full_day",
      reason: leaveFormData.reason,
      status: "pending",
    }
    const { data, error } = await supabase.from("trainer_leaves").insert(insertPayload).select("*").single()
    if (error) {
      console.error("Failed to submit leave:", error)
      return
    }
    setIsLeaveDialogOpen(false)
    resetLeaveForm()
  }

  const handleApproveLeave = (requestId: string) => {
    setLeaveRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, status: "approved" as const, approvedBy: "Admin" } : request,
      ),
    )

    // Update trainer's leave record
    const request = leaveRequests.find((r) => r.id === requestId)
    if (request) {
      setTrainers((prev) =>
        prev.map((trainer) =>
          trainer.id === request.trainerId
            ? {
                ...trainer,
                leaves: [
                  ...trainer.leaves,
                  {
                    startDate: request.startDate,
                    endDate: request.endDate,
                    reason: request.reason,
                    status: "approved" as const,
                  },
                ],
              }
            : trainer,
        ),
      )
    }
  }

  const handleRejectLeave = (requestId: string) => {
    setLeaveRequests((prev) =>
      prev.map((request) => (request.id === requestId ? { ...request, status: "rejected" as const } : request)),
    )
  }

  const handleAddHoliday = async () => {
    const supabase = getSupabaseClient()
    const payload = {
      holiday_date: holidayFormData.date,
      holiday_name: holidayFormData.name,
    }
    const { error } = await supabase.from("holidays").insert(payload)
    if (error) {
      console.error("Failed to add holiday:", error)
      return
    }
    setHolidays([...holidays, { date: holidayFormData.date, name: holidayFormData.name }])
    setIsHolidayDialogOpen(false)
    resetHolidayForm()
  }

  const handleDeleteHoliday = async (date: string) => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from("holidays").delete().eq("holiday_date", date)
    if (error) {
      console.error("Failed to delete holiday:", error)
      return
    }
    setHolidays(holidays.filter((holiday) => holiday.date !== date))
  }

  const resetLeaveForm = () => {
    setLeaveFormData({
      trainerId: "",
      startDate: "",
      endDate: "",
      reason: "",
    })
  }

  const resetHolidayForm = () => {
    setHolidayFormData({
      date: "",
      name: "",
    })
  }

  const getLeaveStats = () => {
    const pending = leaveRequests.filter((r) => r.status === "pending").length
    const approved = leaveRequests.filter((r) => r.status === "approved").length
    const rejected = leaveRequests.filter((r) => r.status === "rejected").length
    return { pending, approved, rejected, total: leaveRequests.length }
  }

  const stats = getLeaveStats()

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
          <h1 className="text-2xl font-bold text-gray-900">Leaves & Holidays</h1>
          <p className="text-gray-600">Manage trainer leave requests and company holidays</p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Leave Request</DialogTitle>
              </DialogHeader>
              <LeaveRequestForm
                formData={leaveFormData}
                setFormData={setLeaveFormData}
                trainers={trainers}
                onSubmit={handleSubmitLeaveRequest}
                onCancel={() => setIsLeaveDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary-gradient hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Company Holiday</DialogTitle>
              </DialogHeader>
              <HolidayForm
                formData={holidayFormData}
                setFormData={setHolidayFormData}
                onSubmit={handleAddHoliday}
                onCancel={() => setIsHolidayDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Leaves</p>
                <p className="text-2xl font-bold text-primary">{stats.approved}</p>
              </div>
                              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Company Holidays</p>
                <p className="text-2xl font-bold text-blue-600">{holidays.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <User className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="holidays">Company Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by trainer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Leave Requests */}
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const trainer = trainers.find((t) => t.id === request.trainerId)
              return (
                <Card key={request.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <h3 className="font-medium">{trainer?.name}</h3>
                            <p className="text-sm text-muted-foreground">{trainer?.email}</p>
                          </div>
                          <StatusBadge status={request.status} />
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium">Leave Period</p>
                            <p className="text-sm text-muted-foreground">
                              {request.startDate} to {request.endDate}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Reason</p>
                            <p className="text-sm text-muted-foreground">{request.reason}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Requested On</p>
                            <p className="text-sm text-muted-foreground">{request.requestDate}</p>
                          </div>
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveLeave(request.id)}
                            className="bg-primary-gradient hover:opacity-90"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectLeave(request.id)}>
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="holidays" className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search holidays..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Holidays */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHolidays.map((holiday) => (
              <Card key={holiday.date}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{holiday.name}</h3>
                      <p className="text-sm text-muted-foreground">{holiday.date}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteHoliday(holiday.date)}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  )
}

interface LeaveRequestFormProps {
  formData: any
  setFormData: (data: any) => void
  trainers: Trainer[]
  onSubmit: () => void
  onCancel: () => void
}

function LeaveRequestForm({ formData, setFormData, trainers, onSubmit, onCancel }: LeaveRequestFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trainer">Trainer</Label>
        <Select value={formData.trainerId} onValueChange={(value) => setFormData({ ...formData, trainerId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select trainer" />
          </SelectTrigger>
          <SelectContent>
            {trainers.map((trainer) => (
              <SelectItem key={trainer.id} value={trainer.id}>
                {trainer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="reason">Reason</Label>
        <Textarea
          id="reason"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Vacation, conference, personal, etc."
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} className="bg-primary-gradient hover:opacity-90">
          Submit Request
        </Button>
      </div>
    </div>
  )
}

interface HolidayFormProps {
  formData: any
  setFormData: (data: any) => void
  onSubmit: () => void
  onCancel: () => void
}

function HolidayForm({ formData, setFormData, onSubmit, onCancel }: HolidayFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="name">Holiday Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="New Year's Day, Christmas, etc."
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} className="bg-primary-gradient hover:opacity-90">
          Add Holiday
        </Button>
      </div>
    </div>
  )
}
