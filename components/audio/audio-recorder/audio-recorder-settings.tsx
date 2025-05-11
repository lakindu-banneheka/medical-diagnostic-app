"use client"

import { Clock, Headphones, BluetoothOffIcon as HeadphonesOff } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

// Available recording durations in seconds
export const RECORDING_DURATIONS = [
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" }
]

interface AudioRecorderSettingsProps {
  recordingDuration: number
  isMonitoring: boolean
  isRecording: boolean
  isProcessing: boolean
  onDurationChange: (duration: number) => void
  onMonitoringChange: (isMonitoring: boolean) => void
  stopRecording: () => void
}

export function AudioRecorderSettings({
  recordingDuration,
  isMonitoring,
  isRecording,
  isProcessing,
  onDurationChange,
  onMonitoringChange,
  stopRecording,
}: AudioRecorderSettingsProps) {
  const handleDurationChange = (value: string) => {
    const duration = Number.parseInt(value, 10)

    // If currently recording, stop it first
    if (isRecording) {
      console.log("Duration changed while recording, stopping current recording")
      stopRecording()
    }

    onDurationChange(duration)

    toast({
      title: "Recording Duration Set",
      description: `Recording will now stop after ${formatDuration(duration)}.`,
    })
  }

  const toggleMonitoring = () => {
    const newValue = !isMonitoring
    onMonitoringChange(newValue)

    // Provide feedback when toggling monitoring
    if (newValue) {
      toast({
        title: "Monitoring Enabled",
        description: "You will now hear the audio while recording.",
      })
    }
  }

  // Helper function to format duration for display
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds`
    } else {
      const minutes = seconds / 60
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
    }
  }

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-1">
      {/* Duration selector */}
      <div className="flex items-center gap-2">
        <Label htmlFor="duration-select" className="text-xs flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          Auto-stop after
        </Label>
        <Select
          value={recordingDuration.toString()}
          onValueChange={handleDurationChange}
          disabled={isRecording || isProcessing}
        >
          <SelectTrigger id="duration-select" className="h-8 w-[130px]">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            {RECORDING_DURATIONS.map((duration) => (
              <SelectItem key={duration.value} value={duration.value.toString()}>
                {duration.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Monitoring toggle */}
      <div className="flex items-center space-x-2">
        <Label htmlFor="monitor-toggle" className="text-xs flex items-center gap-1 cursor-pointer">
          {isMonitoring ? (
            <Headphones className="h-3 w-3 text-primary" />
          ) : (
            <HeadphonesOff className="h-3 w-3 text-muted-foreground" />
          )}
          Monitor Audio
        </Label>
        <Switch
          id="monitor-toggle"
          checked={isMonitoring}
          onCheckedChange={toggleMonitoring}
          aria-label="Toggle audio monitoring"
        />
      </div>
    </div>
  )
}
