"use client"

import { useState, useEffect } from "react"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import { useAudioVisualization } from "@/hooks/use-audio-visualization"
import { useAudioPlayback } from "@/hooks/use-audio-playback"
import { AudioRecorderSettings } from "./audio-recorder-settings"
import { AudioRecorderVisualization } from "./audio-recorder-visualization"
import { AudioRecorderControls } from "./audio-recorder-controls"
import type { AudioRecorderProps } from "./audio-recorder-types"

export function AudioRecorder({ onAudioCaptured }: AudioRecorderProps) {
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0)
  const [currentAudioDuration, setCurrentAudioDuration] = useState(0)

  // Audio recorder hook
  const {
    isRecording,
    isProcessing,
    recordingTime,
    recordingDuration,
    recordedAudioUrl,
    recordingError,
    startRecording,
    stopRecording,
    setRecordingDuration,
    audioDuration,
  } = useAudioRecorder({
    onAudioCaptured,
    initialDuration: 10,
  })

  // Audio visualization hook
  const { canvasRef, drawWaveform } = useAudioVisualization({
    isRecording,
    recordingTime,
    recordingDuration,
    audioStream,
    isPlaying: false,
    playbackTime: currentPlaybackTime,
    audioDuration: currentAudioDuration || audioDuration,
  })

  // Handle playback time updates
  const handlePlaybackTimeUpdate = (time: number, duration: number) => {
    setCurrentPlaybackTime(time)
    if (duration > 0) {
      setCurrentAudioDuration(duration)
    } else if (audioDuration > 0) {
      setCurrentAudioDuration(audioDuration)
    }
  }

  // Audio playback hook
  const { isPlaying, togglePlayback, downloadRecording } = useAudioPlayback({
    audioUrl: recordedAudioUrl,
    onPlaybackTimeUpdate: handlePlaybackTimeUpdate,
  })

  // Set up audio monitoring
  useEffect(() => {
    if (isRecording && audioStream) {
      setupAudioMonitoring(audioStream, isMonitoring)
    }
  }, [isMonitoring, isRecording, audioStream])

  // Handle starting recording and capturing the stream
  const handleStartRecording = async () => {
    try {
      // Reset playback state
      setCurrentPlaybackTime(0)
      setCurrentAudioDuration(0)

      // Get audio stream before starting recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1,
        },
      })

      // Store the stream for visualization and monitoring
      setAudioStream(stream)

      // Start recording with the stream
      await startRecording()
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }

  // Clean up stream when recording stops
  useEffect(() => {
    if (!isRecording && audioStream) {
      // Clean up the stream when recording stops
      audioStream.getTracks().forEach((track) => track.stop())
      setAudioStream(null)
    }
  }, [isRecording, audioStream])

  // Update visualization when playback state changes
  useEffect(() => {
    if (canvasRef.current) {
      drawWaveform()
    }
  }, [isPlaying, currentPlaybackTime, audioDuration, currentAudioDuration])

  // Set up audio monitoring
  const setupAudioMonitoring = (stream: MediaStream, enabled: boolean) => {
    // This is handled in the useAudioRecorder hook
    console.log(`Audio monitoring ${enabled ? "enabled" : "disabled"}`)
  }

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* Settings row */}
      <AudioRecorderSettings
        recordingDuration={recordingDuration}
        isMonitoring={isMonitoring}
        isRecording={isRecording}
        isProcessing={isProcessing}
        onDurationChange={setRecordingDuration}
        onMonitoringChange={setIsMonitoring}
        stopRecording={stopRecording}
      />

      {/* Waveform visualization */}
      <AudioRecorderVisualization
        canvasRef={canvasRef}
        isRecording={isRecording}
        isMonitoring={isMonitoring}
        recordingTime={recordingTime}
        recordingDuration={recordingDuration}
        isPlaying={isPlaying}
        playbackTime={currentPlaybackTime}
        audioDuration={currentAudioDuration || audioDuration}
      />

      {/* Error message */}
      {recordingError && (
        <div className="w-full p-2 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
          <p>{recordingError}</p>
        </div>
      )}

      {/* Controls */}
      <AudioRecorderControls
        isRecording={isRecording}
        isProcessing={isProcessing}
        recordingDuration={recordingDuration}
        recordedAudioUrl={recordedAudioUrl}
        isPlaying={isPlaying}
        audioDuration={currentAudioDuration || audioDuration}
        onStartRecording={handleStartRecording}
        onStopRecording={stopRecording}
        onTogglePlayback={togglePlayback}
        onDownload={downloadRecording}
      />
    </div>
  )
}
