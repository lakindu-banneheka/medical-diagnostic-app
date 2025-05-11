"use client"

import type React from "react"

import { useEffect } from "react"
import { Clock, Headphones, Play } from "lucide-react"
import { formatTime } from "@/utils/format-utils"

interface AudioRecorderVisualizationProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  isRecording: boolean
  isMonitoring: boolean
  recordingTime: number
  recordingDuration: number
  isPlaying?: boolean
  playbackTime?: number
  audioDuration?: number
}

export function AudioRecorderVisualization({
  canvasRef,
  isRecording,
  isMonitoring,
  recordingTime,
  recordingDuration,
  isPlaying = false,
  playbackTime = 0,
  audioDuration = 0,
}: AudioRecorderVisualizationProps) {
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // This will trigger a redraw in the parent component
      if (canvasRef.current) {
        const event = new Event("resize")
        window.dispatchEvent(event)
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [canvasRef])

  return (
    <div className="w-full h-40 rounded-md overflow-hidden bg-card relative shadow-md border border-border">
      <canvas ref={canvasRef} height={160} className="w-full h-full" />

      {/* Medical grade indicator */}
      <div className="absolute top-2 right-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full">
        Medical-grade
      </div>

      {/* Recording time indicator */}
      {isRecording && (
        <div className="absolute bottom-2 left-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full">
          {formatTime(recordingTime)} / {formatTime(recordingDuration)}
        </div>
      )}

      {/* Playback time indicator */}
      {!isRecording && audioDuration > 0 && (
        <div className="absolute bottom-2 left-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
          {isPlaying && <Play className="h-3 w-3" />}
          {formatTime(playbackTime)} / {formatTime(audioDuration)}
        </div>
      )}

      {/* Monitoring indicator */}
      {isRecording && isMonitoring && (
        <div className="absolute bottom-2 right-2 bg-primary/50 text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Headphones className="h-3 w-3" />
          Monitoring
        </div>
      )}

      {/* Auto-stop indicator */}
      {isRecording && (
        <div className="absolute top-2 left-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Auto-stop: {formatTime(recordingDuration - recordingTime)}
        </div>
      )}
    </div>
  )
}
