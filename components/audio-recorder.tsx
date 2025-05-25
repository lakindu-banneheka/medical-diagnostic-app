"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Mic,
  Square,
  Loader2,
  Download,
  Play,
  Pause,
  Headphones,
  BluetoothOffIcon as HeadphonesOff,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { blobToWavFile } from "@/lib/wavEncoder"
import axios from "axios"

interface AudioRecorderProps {
  onAudioCaptured: (file: File) => void
}

// Available recording durations in seconds
export const RECORDING_DURATIONS = [
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" }
]

export function AudioRecorder({ onAudioCaptured }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [recordingDuration, setRecordingDuration] = useState(5)
  const [isNoiseReduingProcessing, setIsNoiseReducingProcessing] = useState(false)
  const [ canvasAudioFile, setCanvasAudioFile] = useState<File | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const frequencyDataRef = useRef<Uint8Array | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const recordedAudioBlobRef = useRef<Blob | null>(null)
  const monitorNodeRef = useRef<GainNode | null>(null)
  const { theme } = useTheme()
  // Store a static snapshot of the waveform image for playback indicator
  const staticImageRef = useRef<ImageData | null>(null)

  const MAX_BUFFER_SIZE = 1024 * 200 // Increased buffer size for medical-grade precision

  // Initialize audio element
  useEffect(() => {
    audioElementRef.current = new Audio()

    audioElementRef.current.addEventListener("loadedmetadata", () => {
      if (audioElementRef.current) {
        setAudioDuration(audioElementRef.current.duration)
      }
    })

    audioElementRef.current.addEventListener("ended", () => {
      setIsPlaying(false)
      setPlaybackTime(0)
    })

    audioElementRef.current.addEventListener("timeupdate", () => {
      if (audioElementRef.current) {
        setPlaybackTime(audioElementRef.current.currentTime)
      }
    })

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.src = ""
        audioElementRef.current.removeEventListener("ended", () => {
          setIsPlaying(false)
        })
        audioElementRef.current.removeEventListener("timeupdate", () => {})
        audioElementRef.current.removeEventListener("loadedmetadata", () => {})
      }
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupResources()

      // Revoke any object URLs to prevent memory leaks
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
    }
  }, [recordedAudioUrl])

  // Redraw waveform when theme changes
  useEffect(() => {
    if (canvasRef.current && recordedAudioUrl) {
      drawWaveform()
    }
  }, [theme])

  // Toggle audio monitoring
  useEffect(() => {
    if (isRecording && audioContextRef.current && monitorNodeRef.current) {
      if (isMonitoring) {
        // Connect the monitor node to the audio context destination to hear the audio
        monitorNodeRef.current.gain.value = 1.0
      } else {
        // Disconnect by setting gain to 0
        monitorNodeRef.current.gain.value = 0
      }
    }
  }, [isMonitoring, isRecording])

  // Update audio element source when recorded audio URL changes
  useEffect(() => {
    if (audioElementRef.current && recordedAudioUrl) {
      audioElementRef.current.src = recordedAudioUrl
      audioElementRef.current.preload = "metadata"
      audioElementRef.current.load()
    }
  }, [recordedAudioUrl])

  // Noise reduction function
  const reduceNoise = async (file: File) => {
    setIsNoiseReducingProcessing(true)

    // get the noise file from the audio file with error handling
    const noiseFile = new File([file], "./noise/noise.wav", { type: "audio/wav" })
    if (!noiseFile) {
      toast({
        title: "Noise Reduction Error",
        description: "No noise file provided for noise reduction.",
        variant: "destructive",
      })
      setIsNoiseReducingProcessing(false)
      return
    }
  
    if(!file) {
      toast({
        title: "Noise Reduction Error",
        description: "No audio file provided for noise reduction.",
        variant: "destructive",
      })
      setIsNoiseReducingProcessing(false)
      return
    }

    try {
      // Create FormData to send the file
      const formData = new FormData()
      formData.append("noise_only", noiseFile)
      formData.append("heart_noisy", file)

      // API call to AWS Lambda using Axios
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/noise-reduction`, formData, {
        responseType: 'blob',     
        headers: {
            'Accept': 'audio/wav',
            'Content-Type': 'multipart/form-data',
        },
      })

      if (response.status !== 200) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      // Create a Blob from the response data
      const wavBlob = new Blob([response.data as ArrayBuffer], { type: 'audio/wav' });

      recordedAudioBlobRef.current = wavBlob

      // Create WAV file for analysis
      const wavFile = await blobToWavFile(wavBlob, 'medical_recording.wav');
      
      // Create object URL for playback
      const audioUrl = URL.createObjectURL(wavFile)
      setRecordedAudioUrl(audioUrl)

      // Render the denoised waveform on canvas
      setCanvasAudioFile(wavFile)

      // Send the file to the parent component
      onAudioCaptured(wavFile)

    } catch (error) {
      console.error("Error reducing noise:", error)
      toast({
        title: "Noise Reduction Error",
        description: "There was an error reducing noise. Please try again.",
        variant: "destructive",
      })
    }
    finally {
      setIsNoiseReducingProcessing(false)
    }
  }

  // Draw waveform from recorded audio File
  useEffect(() => {
    if(canvasRef.current && canvasAudioFile && !isNoiseReduingProcessing && !isRecording) {
      drawWavFile(canvasAudioFile)
    }
  }, [canvasRef.current, canvasAudioFile]);

  // Cleanup function to stop all resources
  const cleanupResources = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(console.error)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
  }

  // Replace the startRecording function with this improved version that ensures recording stops properly
  const startRecording = async () => {
    setRecordingError(null)
    setRecordedAudioUrl(null)
    recordedAudioBlobRef.current = null
    setPlaybackTime(0)
    setAudioDuration(0)

    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current.src = ""
      setIsPlaying(false)
    }

    try {
      // Clean up any existing resources first
      cleanupResources()

      // Reset state
      setRecordingTime(0)
      audioChunksRef.current = []
      audioBufferRef.current = []

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

      // Create high-precision analyzer
      const analyser = audioContext.createAnalyser()
      analyserRef.current = analyser
      analyser.fftSize = 4096 // Much higher FFT size for medical-grade precision
      analyser.smoothingTimeConstant = 0.2 // Lower smoothing for more accurate representation

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Create a gain node for monitoring (hearing the audio while recording)
      const monitorNode = audioContext.createGain()
      monitorNodeRef.current = monitorNode

      // Set initial gain based on monitoring state
      monitorNode.gain.value = isMonitoring ? 1.0 : 0

      // Connect the source to the monitor node and then to the destination
      source.connect(monitorNode)
      monitorNode.connect(audioContext.destination)

      // Create data arrays for visualization
      const bufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
      frequencyDataRef.current = new Uint8Array(bufferLength)

      // Create a script processor to capture raw audio data for visualization
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer
        const inputData = inputBuffer.getChannelData(0)

        // Store audio data with high precision
        const bufferData = new Float32Array(inputData.length)
        bufferData.set(inputData)
        audioBufferRef.current.push(bufferData)

        // Limit buffer size to prevent memory issues
        if (audioBufferRef.current.length > MAX_BUFFER_SIZE) {
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
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        console.log("MediaRecorder onstop event triggered")
        setIsProcessing(true)

        // Ensure recording state is updated
        setIsRecording(false)

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
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          recordedAudioBlobRef.current = audioBlob

          // Create WAV file for analysis
          const wavFile = await blobToWavFile(audioBlob, 'medical_recording.wav');
          
          // Create object URL for playback
          const audioUrl = URL.createObjectURL(wavFile)
          setRecordedAudioUrl(audioUrl)

          // Reduece the noise in the audio file
          reduceNoise(wavFile)

          // Send the file to the parent component
          // onAudioCaptured(wavFile)
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
          // Stop any ongoing recording waveform animation
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }
        }
      }

      // Start recording with small time slices for more frequent data updates
      mediaRecorderRef.current.start(50) // Smaller time slices for more frequent updates
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

      // Start visualization
      if (canvasRef.current) {
        drawWaveform()
      }

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

  // Add this new function to force stop recording in all cases
  const forceStopRecording = () => {
    console.log("Force stopping recording...")

    // First update UI state to show we're stopping
    setIsRecording(false)

    // Clear any timers
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
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

    // Cancel any animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
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

  // Replace the stopRecording function with this improved version
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      console.log("Stop recording called but recorder is not active")
      return
    }

    console.log("Stopping recording...")
    forceStopRecording()
  }

  const drawWaveform = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext("2d", { alpha: false }) // Disable alpha for better performance
    if (!canvasCtx) return

    // Get the actual width of the container
    const containerWidth = canvas.parentElement?.clientWidth || canvas.width
    const height = canvas.height

    // Set canvas dimensions to match container
    canvas.width = containerWidth
    canvas.height = height

    // Adjust canvas for device pixel ratio to prevent blurry lines
    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = height * dpr
    canvasCtx.scale(dpr, dpr)

    // Style canvas element
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${height}px`

    // Get theme-appropriate colors
    const isDarkTheme = theme === "dark"
    const backgroundColor = isDarkTheme ? "#1E1E1E" : "#F5F6FA"
    const waveformColor = isDarkTheme ? "#AAAAAA" : "#4A90E2"
    const highlightColor = isDarkTheme ? "#4A90E2" : "#2563EB"
    const gridColor = isDarkTheme ? "#333333" : "#E0E3E7"

    const draw = () => {
      if (!canvasCtx) return

      animationFrameRef.current = requestAnimationFrame(draw)

      // Fill background with theme-appropriate color
      canvasCtx.fillStyle = backgroundColor
      canvasCtx.fillRect(0, 0, containerWidth, height)

      // Get current audio data if recording
      if (isRecording && analyserRef.current && dataArrayRef.current && frequencyDataRef.current) {
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current)
        analyserRef.current.getByteFrequencyData(frequencyDataRef.current)
      }

      drawDetailedWaveform(canvasCtx, containerWidth, height, {
        waveformColor,
        highlightColor,
        gridColor,
      })
    }

    draw()
  }

  // Draw waveform from WAV file
  const drawWavFile = async (file: File) => {
  if (!canvasRef.current) return;

  // Create & resume audio context
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  try {
    // Read file into ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Decode WAV data, with Promise + callback fallback
    let audioBuffer: AudioBuffer;
    if (audioCtx.decodeAudioData.length === 1) {
      // Promise-based
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } else {
      // Callback-based
      audioBuffer = await new Promise((resolve, reject) => {
        audioCtx.decodeAudioData(
          arrayBuffer,
          buffer => resolve(buffer),
          err => reject(err)
        );
      });
    }

    // Extract mono data
    const rawData = audioBuffer.getChannelData(0);

    // Prepare canvas
    const canvas = canvasRef.current!;
    const containerWidth = canvas.parentElement?.clientWidth || canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.clearRect(0, 0, containerWidth, height);
    ctx.fillStyle = theme === 'dark' ? '#1E1E1E' : '#F5F6FA';
    ctx.fillRect(0, 0, containerWidth, height);

    // Compute step (at least 1 sample per pixel)
    const step = Math.max(Math.floor(rawData.length / containerWidth), 1);
    const amp = height / 2;

    // Draw waveform
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme === 'dark' ? '#AAAAAA' : '#4A90E2';
    ctx.beginPath();
    for (let i = 0; i < containerWidth; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = rawData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const yLow = (1 + min) * amp;
      const yHigh = (1 + max) * amp;
      ctx.moveTo(i, yLow);
      ctx.lineTo(i, yHigh);
    }
    ctx.stroke();
    // Capture static waveform image for playback indicator
    staticImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

  } catch (err) {
    console.error('Error drawing WAV file:', err);
    toast({
      title: 'Waveform Error',
      description: 'Could not render waveform. Please try again.',
      variant: 'destructive',
    });
  }
  };

  // Draw detailed waveform with peaks and average lines
  const drawDetailedWaveform = (
    canvasCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colors: {
      waveformColor: string
      highlightColor: string
      gridColor: string
    },
  ) => {
    if (!dataArrayRef.current && audioBufferRef.current.length === 0) return

    // Draw from stored audio buffer for historical data
    const combinedBuffer = combineAudioBuffers()

    // Use thin lines for detailed visualization
    const lineWidth = 1
    const spacing = 0
    const totalLines = Math.floor(width / (lineWidth + spacing))
    const samplesPerLine = Math.max(1, Math.floor(combinedBuffer.length / totalLines))

    // Draw center reference line
    canvasCtx.beginPath()
    canvasCtx.moveTo(0, height / 2)
    canvasCtx.lineTo(width, height / 2)
    canvasCtx.strokeStyle = colors.gridColor
    canvasCtx.stroke()

    // Draw detailed waveform
    canvasCtx.strokeStyle = colors.waveformColor

    // Use path for better performance
    canvasCtx.beginPath()

    for (let i = 0; i < totalLines; i++) {
      // Calculate average and peak amplitude for this segment
      let sum = 0
      let peakPositive = 0
      let peakNegative = 0
      let count = 0

      for (let j = 0; j < samplesPerLine; j++) {
        const dataIndex = i * samplesPerLine + j
        if (dataIndex < combinedBuffer.length) {
          const value = combinedBuffer[dataIndex]
          sum += value
          peakPositive = Math.max(peakPositive, value)
          peakNegative = Math.min(peakNegative, value)
          count++
        }
      }

      // Use peak values for more accurate medical visualization
      const x = i * (lineWidth + spacing)

      // Draw line from peak negative to peak positive
      const negativeY = height / 2 + ((peakNegative * height) / 2) * 3
      const positiveY = height / 2 + ((peakPositive * height) / 2) * 3

      canvasCtx.moveTo(x, negativeY)
      canvasCtx.lineTo(x, positiveY)
    }

    canvasCtx.stroke()

    // Draw real-time overlay for current audio
    if (isRecording && dataArrayRef.current) {
      canvasCtx.strokeStyle = colors.highlightColor
      canvasCtx.lineWidth = 2
      canvasCtx.beginPath()

      const sliceWidth = width / dataArrayRef.current.length
      let x = 0

      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const v = dataArrayRef.current[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          canvasCtx.moveTo(x, y)
        } else {
          canvasCtx.lineTo(x, y)
        }

        x += sliceWidth
      }

      canvasCtx.stroke()
    }

    // Draw recording progress indicator
    if (isRecording) {
      const progress = recordingTime / recordingDuration
      const indicatorWidth = width * progress

      canvasCtx.fillStyle = `${colors.highlightColor}40` // 25% opacity
      canvasCtx.fillRect(0, 0, indicatorWidth, 4)
    }
  }

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        drawWaveform()
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Draw a playback progress indicator on canvas during audio playback
  useEffect(() => {
    let rafId: number
    const drawPlaybackIndicator = () => {
      if (!canvasRef.current || !audioElementRef.current || audioDuration === 0) {
        rafId = requestAnimationFrame(drawPlaybackIndicator)
        return
      }
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafId = requestAnimationFrame(drawPlaybackIndicator)
        return
      }
      // Reset any transforms so pixel drawing aligns
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      // Clear previous overlay and redraw static waveform
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (staticImageRef.current) {
        ctx.putImageData(staticImageRef.current, 0, 0)
      }
      // Compute playback progress and x-position
      const progress = audioElementRef.current.currentTime / audioDuration
      const x = progress * canvas.width
      ctx.save()
      ctx.strokeStyle = theme === 'dark' ? '#FF4D4F' : '#D93025'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
      ctx.restore()
      rafId = requestAnimationFrame(drawPlaybackIndicator)
    }
    if (isPlaying) {
      rafId = requestAnimationFrame(drawPlaybackIndicator)
    }
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [isPlaying, audioDuration, theme, recordedAudioUrl])

  const togglePlayback = () => {
    if (!audioElementRef.current || !recordedAudioUrl) return

    if (isPlaying) {
      audioElementRef.current.pause()
      setIsPlaying(false)
    } else {
      audioElementRef.current.play().catch((error) => {
        console.error("Error playing audio:", error)
        toast({
          title: "Playback Error",
          description: "Could not play the recording. Please try again.",
          variant: "destructive",
        })
      })
      setIsPlaying(true)
    }
  }

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring)

    // Provide feedback when toggling monitoring
    if (!isMonitoring) {
      toast({
        title: "Monitoring Enabled",
        description: "You will now hear the audio while recording.",
      })
    }
  }

  const handleDurationChange = (value: string) => {
    const duration = Number.parseInt(value, 10)

    // If currently recording, stop it first
    if (isRecording) {
      console.log("Duration changed while recording, stopping current recording")
      stopRecording()
    }

    setRecordingDuration(duration)

    toast({
      title: "Recording Duration Set",
      description: `Recording will now stop after ${formatTime(duration)}.`,
    })
  }

  const downloadRecording = () => {
    if (!recordedAudioUrl) return

    try {
      // Create a download link
      const downloadLink = document.createElement("a")
      downloadLink.href = recordedAudioUrl
      downloadLink.download = `medical_recording_${new Date().toISOString().slice(0, 10)}.wav`

      // Append to the document, click it, and remove it
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)

      toast({
        title: "Download Started",
        description: "Your recording is being downloaded.",
      })
    } catch (error) {
      console.error("Error downloading recording:", error)
      toast({
        title: "Download Error",
        description: "Could not download the recording. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Combine all audio buffers into a single array for visualization
  const combineAudioBuffers = (): Float32Array => {
    // Calculate total length
    let totalLength = 0
    for (const buffer of audioBufferRef.current) {
      totalLength += buffer.length
    }

    // Create combined buffer
    const result = new Float32Array(totalLength)
    let offset = 0

    // Copy data
    for (const buffer of audioBufferRef.current) {
      result.set(buffer, offset)
      offset += buffer.length
    }

    return result
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Ensure recording stops when component unmounts or when duration changes
  useEffect(() => {
    return () => {
      if (isRecording) {
        console.log("Component unmounting or duration changed while recording, stopping recording")
        stopRecording()
      }
    }
  }, [recordingDuration])

  return (
    <div className="flex flex-col items-center space-y-4 w-full">

      {/* Noise reduction processing indicator */}
      {isNoiseReduingProcessing && (
        <div className="w-full p-2 bg-muted/10 border border-muted/30 rounded-md text-muted-foreground text-sm flex items-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary"></div>
          <p>Denoising...</p>
        </div>
      )}

      {/* Animated noise reduction visualization */}
      {isNoiseReduingProcessing && (
        <div className="w-full h-40 mt-2 bg-muted/10 border border-muted/30 rounded-md overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Processing...</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30 animate-pulse"></div>
        </div>
      )}


      {/* Settings row */}
      { !isNoiseReduingProcessing && (
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
      )}


      {/* Waveform visualization */}
      { !isNoiseReduingProcessing && (
        <div className="w-full h-40 rounded-md overflow-hidden bg-card relative shadow-md border border-border">
              <canvas ref={canvasRef} height={160} className="w-full h-full" />

          {/* Medical grade indicator */}
          {/* <div className="absolute top-2 right-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full">
            Medical-grade
          </div> */}

          {/* Recording time indicator */}
          {isRecording && (
            <div className="absolute bottom-2 left-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full">
              {formatTime(recordingTime)} / {formatTime(recordingDuration)}
            </div>
          )}

          {!isRecording && (
            <div className="absolute bottom-2 left-2 bg-background/50 dark:bg-background/70 text-foreground text-xs px-2 py-1 rounded-full">
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
      )}

      {/* Error message */}
      {recordingError && (
        <div className="w-full p-2 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
          <p>{recordingError}</p>
        </div>
      )}

      {/* Controls */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-2">
        <div className="relative">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing || isNoiseReduingProcessing}
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
        {recordedAudioUrl && !isRecording && !isProcessing && !isNoiseReduingProcessing && (
          <div className="flex gap-2">
            <Button
              onClick={togglePlayback}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              onClick={downloadRecording}
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
    </div>
  )
}
