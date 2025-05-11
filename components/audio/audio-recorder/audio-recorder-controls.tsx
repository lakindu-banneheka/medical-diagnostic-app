"use client"

import { Mic, Square, Loader2, Download, Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatTime } from "@/utils/format-utils"

interface AudioRecorderControlsProps {
  isRecording: boolean
  isProcessing: boolean
  recordingDuration: number
  recordedAudioUrl: string | null
  isPlaying: boolean
  audioDuration: number
  onStartRecording: () => void
  onStopRecording: () => void
  onTogglePlayback: () => void
  onDownload: () => void
}

export function AudioRecorderControls({
  isRecording,
  isProcessing,
  recordingDuration,
  recordedAudioUrl,
  isPlaying,
  audioDuration,
  onStartRecording,
  onStopRecording,
  onTogglePlayback,
  onDownload,
}: AudioRecorderControlsProps) {
  return (
    <>
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-2">
        <div className="relative">
          <Button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isProcessing}
            className={cn(
              "relative rounded-full w-16 h-16 p-0 transition-all shadow-md",
              isRecording ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90",
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <Square className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}

            {/* Pulsing animation when recording */}
            {isRecording && (
              <>
                <span
                  className="absolute inset-0 rounded-full animate-ping bg-destructive opacity-30"
                  style={{ animationDuration: "1.5s" }}
                ></span>
                <span
                  className="absolute inset-0 rounded-full animate-ping bg-destructive opacity-20"
                  style={{ animationDuration: "2s", animationDelay: "0.5s" }}
                ></span>
              </>
            )}
          </Button>
        </div>

        <div className="text-center sm:text-left flex-1">
          <p className="text-sm font-medium text-foreground">
            {isProcessing ? "Processing recording..." : isRecording ? "Recording in progress" : "Ready to record"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isProcessing
              ? "Please wait while we analyze your audio"
              : isRecording
                ? `Recording will auto-stop after ${formatTime(recordingDuration)}`
                : "Tap the button to start recording"}
          </p>
        </div>

        {/* Playback and download controls */}
        {recordedAudioUrl && !isRecording && !isProcessing && (
          <div className="flex gap-2">
            <Button
              onClick={onTogglePlayback}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              onClick={onDownload}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Download recording"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Recording duration info */}
      {recordedAudioUrl && !isRecording && !isProcessing && audioDuration > 0 && (
        <div className="w-full text-center text-xs text-muted-foreground">
          Recording duration: {formatTime(audioDuration)}
        </div>
      )}
    </>
  )
}
