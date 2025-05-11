"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "@/components/ui/use-toast"
import { formatTime } from "@/utils/format-utils"

interface UseAudioRecorderProps {
  onAudioCaptured: (file: File) => void
  initialDuration?: number
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  isProcessing: boolean
  recordingTime: number
  recordingDuration: number
  recordedAudioUrl: string | null
  recordingError: string | null
  audioChunks: Blob[]
  audioDuration: number
  startRecording: () => Promise<void>
  stopRecording: () => void
  setRecordingDuration: (duration: number) => void
  cleanupResources: () => void
}

export function useAudioRecorder({
  onAudioCaptured,
  initialDuration = 10,
}: UseAudioRecorderProps): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(initialDuration)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupResources()

      // Revoke any object URLs to prevent memory leaks
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
    }
  }, [recordedAudioUrl])

  // Ensure recording stops when component unmounts or when duration changes
  useEffect(() => {
    return () => {
      if (isRecording) {
        console.log("Component unmounting or duration changed while recording, stopping recording")
        stopRecording()
      }
    }
  }, [recordingDuration, isRecording])

  const cleanupResources = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(console.error)
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const forceStopRecording = () => {
    console.log("Force stopping recording...")

    // First update UI state to show we're stopping
    setIsRecording(false)

    // Clear any timers
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Calculate actual recording duration before stopping
    let actualDuration = recordingDuration
    if (recordingStartTimeRef.current) {
      const recordingEndTime = Date.now()
      actualDuration = (recordingEndTime - recordingStartTimeRef.current) / 1000
      console.log(`Actual recording duration before force stop: ${actualDuration} seconds`)

      // Store the actual duration
      setAudioDuration(actualDuration)
    }

    // Request a final chunk of data before stopping
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.requestData()
      } catch (e) {
        console.error("Error requesting final data chunk:", e)
      }
    }

    // Stop the MediaRecorder if it exists and is recording
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === "recording") {
          console.log("Stopping MediaRecorder")
          mediaRecorderRef.current.stop()
        }
      } catch (e) {
        console.error("Error stopping MediaRecorder:", e)
      }
    }

    // Stop all audio tracks directly
    if (streamRef.current) {
      try {
        console.log("Stopping all audio tracks")
        streamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
      } catch (e) {
        console.error("Error stopping audio tracks:", e)
      }
    }

    // Close audio context to ensure all audio processing stops
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          console.log("Closing AudioContext")
          audioContextRef.current.close()
        }
      } catch (e) {
        console.error("Error closing AudioContext:", e)
      }
    }

    // If no data was captured, show an error
    if (audioChunksRef.current.length === 0) {
      setRecordingError("No audio data was captured. Please try again.")
      toast({
        title: "Recording Error",
        description: "No audio data was captured. Please try again.",
        variant: "destructive",
      })
    }

    console.log("Recording forcibly stopped")
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      console.log("Stop recording called but recorder is not active")
      return
    }

    console.log("Stopping recording...")
    forceStopRecording()
  }

  const startRecording = async () => {
    setRecordingError(null)
    setRecordedAudioUrl(null)
    setRecordingTime(0)
    setAudioDuration(0)
    audioBufferRef.current = []

    try {
      // Clean up any existing resources first
      cleanupResources()

      // Reset state
      audioChunksRef.current = []

      // Store the recording start time
      recordingStartTimeRef.current = Date.now()

      // Get audio stream with high-quality settings for medical applications
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Disable echo cancellation for medical accuracy
          noiseSuppression: false, // Disable noise suppression to preserve all audio details
          autoGainControl: false, // Disable auto gain to maintain consistent levels
          sampleRate: 48000, // Higher sample rate for medical-grade audio
          channelCount: 1, // Mono for simplicity and focus on respiratory sounds
        },
      })
      streamRef.current = stream

      // Set up audio context with high precision settings
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000, // Higher sample rate for medical applications
        latencyHint: "interactive",
      })
      audioContextRef.current = audioContext

      // Create analyzer for visualization
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 4096

      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Create script processor to capture audio data for visualization
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer
        const inputData = inputBuffer.getChannelData(0)

        // Store audio data for visualization
        const bufferData = new Float32Array(inputData.length)
        bufferData.set(inputData)
        audioBufferRef.current.push(bufferData)

        // Limit buffer size to prevent memory issues
        if (audioBufferRef.current.length > 1000) {
          audioBufferRef.current.shift()
        }
      }

      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      // Set up media recorder with highest quality settings
      const options = {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 256000, // Higher bitrate for medical-grade audio
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options)

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Received audio chunk of size: ${event.data.size} bytes`)
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        console.log("MediaRecorder onstop event triggered")
        setIsProcessing(true)

        // Ensure recording state is updated
        setIsRecording(false)

        // Calculate actual recording duration if not already set
        if (recordingStartTimeRef.current && audioDuration === 0) {
          const recordingEndTime = Date.now()
          const actualDuration = (recordingEndTime - recordingStartTimeRef.current) / 1000
          console.log(`Actual recording duration: ${actualDuration} seconds`)
          setAudioDuration(actualDuration)
        }

        // Double-check that all tracks are stopped
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            if (track.readyState === "live") {
              console.log("Track still live in onstop handler, stopping it")
              track.stop()
            }
          })
        }

        try {
          // Ensure we have audio chunks
          if (audioChunksRef.current.length === 0) {
            throw new Error("No audio data was captured")
          }

          console.log(`Processing ${audioChunksRef.current.length} audio chunks`)

          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          console.log(`Created audio blob of size: ${audioBlob.size} bytes`)

          // Create object URL for playback
          const audioUrl = URL.createObjectURL(audioBlob)
          setRecordedAudioUrl(audioUrl)

          // Make sure we have a valid duration
          const finalDuration = audioDuration > 0 ? audioDuration : recordingDuration

          // Create WAV file with duration metadata
          const wavFile = createWavFile(audioBlob, finalDuration)

          // Send the file to the parent component
          onAudioCaptured(wavFile)
        } catch (error) {
          console.error("Error processing audio:", error)
          setRecordingError("There was an error processing your recording. Please try again.")
          toast({
            title: "Processing Error",
            description: "There was an error processing your recording. Please try again.",
            variant: "destructive",
          })
        } finally {
          setIsProcessing(false)
        }
      }

      // Start recording with small time slices for more frequent data updates
      mediaRecorderRef.current.start(100) // Get data every 100ms
      setIsRecording(true)

      // Create a hard deadline for stopping the recording
      const stopTimeout = setTimeout(
        () => {
          if (isRecording) {
            console.log("Hard deadline reached, forcing recording to stop")
            forceStopRecording()
          }
        },
        recordingDuration * 1000 + 500,
      ) // Add 500ms buffer

      // Start timer with auto-stop after selected duration
      const startTime = Date.now()
      const endTime = startTime + recordingDuration * 1000

      timerRef.current = setInterval(() => {
        const currentTime = Date.now()
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)

        setRecordingTime(elapsedSeconds)

        // Check if we've reached or exceeded the recording duration
        if (currentTime >= endTime) {
          console.log("Auto-stop triggered: Recording duration reached")
          // Clear the interval first to prevent any race conditions
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }

          // Clear the hard deadline timeout since we're stopping normally
          clearTimeout(stopTimeout)

          // Then stop the recording
          forceStopRecording()
          return
        }
      }, 100) // Check more frequently (every 100ms) for more precise timing

      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(100)
      }

      // Notify user about auto-stop
      toast({
        title: "Recording Started",
        description: `Recording will automatically stop after ${formatTime(recordingDuration)}.`,
      })
    } catch (error) {
      console.error("Error starting recording:", error)
      setRecordingError("Could not access microphone. Please check your permissions.")
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check your permissions.",
        variant: "destructive",
      })
    }
  }

  // Helper function to create a WAV file with proper duration metadata
  const createWavFile = (audioBlob: Blob, duration: number): File => {
    // Create a file with the current timestamp
    const fileName = `medical_recording_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.wav`

    // Create a file with additional properties
    const file = new File([audioBlob], fileName, {
      type: "audio/wav",
      lastModified: Date.now(),
    })

    // Log file details
    console.log(`Created WAV file: ${fileName}, size: ${file.size} bytes, duration: ${duration} seconds`)

    return file
  }

  return {
    isRecording,
    isProcessing,
    recordingTime,
    recordingDuration,
    recordedAudioUrl,
    recordingError,
    audioChunks: audioChunksRef.current,
    audioDuration,
    startRecording,
    stopRecording,
    setRecordingDuration,
    cleanupResources,
  }
}
