"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Bell, Database, Clock, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

export default function SettingsPage() {
  const [timeSlots, setTimeSlots] = useState([
    { id: 1, name: "Morning", start: "09:00", end: "11:00" },
    { id: 2, name: "Afternoon", start: "14:00", end: "16:00" },
    { id: 3, name: "Evening", start: "18:00", end: "20:00" },
  ])

  const addTimeSlot = () => {
    const newId = Math.max(...timeSlots.map((slot) => slot.id)) + 1
    setTimeSlots([...timeSlots, { id: newId, name: "", start: "09:00", end: "11:00" }])
  }

  const removeTimeSlot = (id: number) => {
    setTimeSlots(timeSlots.filter((slot) => slot.id !== id))
  }

  const updateTimeSlot = (id: number, field: string, value: string) => {
    setTimeSlots(timeSlots.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot)))
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your system preferences and configuration</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Online Batch Time Slots
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure available time slots for online batches. Each slot should be 2 hours.
              </p>

              <div className="space-y-3">
                {timeSlots.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Input
                      placeholder="Slot name (e.g., Morning)"
                      value={slot.name}
                      onChange={(e) => updateTimeSlot(slot.id, "name", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateTimeSlot(slot.id, "start", e.target.value)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateTimeSlot(slot.id, "end", e.target.value)}
                      className="w-32"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeTimeSlot(slot.id)}
                      disabled={timeSlots.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={addTimeSlot} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Slot
                </Button>
                <Button>Save Time Slots</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <Input defaultValue="Admin User" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input defaultValue="admin@example.com" />
                </div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Email Notifications</span>
                <Button variant="outline" size="sm">
                  Enabled
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>Schedule Alerts</span>
                <Button variant="outline" size="sm">
                  Enabled
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>Conflict Warnings</span>
                <Button variant="outline" size="sm">
                  Enabled
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Default Time Zone</label>
                <select className="w-full p-2 border rounded-lg">
                  <option>Asia/Kolkata (IST)</option>
                  <option>UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Working Hours</label>
                <div className="grid grid-cols-2 gap-4">
                  <Input defaultValue="09:00" type="time" />
                  <Input defaultValue="18:00" type="time" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Available Locations</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    <span>Online</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    <span>Kochi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    <span>Calicut</span>
                  </div>
                </div>
              </div>
              <Button>Update Configuration</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}
