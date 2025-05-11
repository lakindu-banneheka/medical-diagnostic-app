"use client"

import { useRef, useEffect } from "react"
import { useTheme } from "next-themes"

interface UseAudioVisualizationProps {
  isRecording: boolean
  recordingTime: number
  recordingDuration: number
  audioStream?: MediaStream | null
  isPlaying?: boolean
  playbackTime?: number
  audioDuration?: number
}

interface WaveformColors {
  backgroundColor: string
  waveformColor: string
  highlightColor: string
  gridColor: string
  playbackColor: string
}

export function useAudioVisualization({
  isRecording,
  recordingTime,
  recordingDuration,
  audioStream,
  isPlaying = false,
  playbackTime = 0,
  audioDuration = 0,
}: UseAudioVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const frequencyDataRef = useRef<Uint8Array | null>(null)
  const { theme } = useTheme()

  const MAX_BUFFER_SIZE = 1024 * 200 // Increased buffer size for medical-grade precision

  // Initialize audio context and analyzer when recording starts
  useEffect(() => {
    if (isRecording && audioStream) {
      setupAudioContext(audioStream)
    }

    return () => {
      cleanupVisualization()
    }
  }, [isRecording, audioStream])

  // Redraw waveform when theme changes
  useEffect(() => {
    if (canvasRef.current) {
      // Cancel any existing animation frame before redrawing
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Redraw the waveform with the new theme
      drawWaveform()
    }
  }, [theme])

  // Redraw waveform when playback time changes
  useEffect(() => {
    if (!isRecording && isPlaying && canvasRef.current) {
      drawWaveform()
    }
  }, [playbackTime, isPlaying, isRecording])

  const setupAudioContext = (stream: MediaStream) => {
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

    // Start visualization
    drawWaveform()
  }

  const cleanupVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  const getThemeColors = (): WaveformColors => {
    const isDarkTheme = theme === "dark"
    return {
      backgroundColor: isDarkTheme ? "#1E1E1E" : "#F5F6FA",
      waveformColor: isDarkTheme ? "#AAAAAA" : "#4A90E2",
      highlightColor: isDarkTheme ? "#4A90E2" : "#2563EB",
      gridColor: isDarkTheme ? "#333333" : "#E0E3E7",
      playbackColor: isDarkTheme ? "#38BDF8" : "#3B82F6",
    }
  }

  const drawWaveform = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext("2d", { alpha: false }) // Disable alpha for better performance
    if (!canvasCtx) return

    // Cancel any existing animation frame before redrawing
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Get the actual width of the container
    const containerWidth = canvas.parentElement?.clientWidth || canvas.width
    const height = canvas.height

    // Set canvas dimensions to match container - this also clears the canvas
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
    const colors = getThemeColors()

    const draw = () => {
      if (!canvasCtx) return

      // Clear the canvas completely before redrawing
      canvasCtx.clearRect(0, 0, containerWidth, height)
      canvasCtx.fillStyle = colors.backgroundColor
      canvasCtx.fillRect(0, 0, containerWidth, height)

      // Get current audio data if recording
      if (isRecording && analyserRef.current && dataArrayRef.current && frequencyDataRef.current) {
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current)
        analyserRef.current.getByteFrequencyData(frequencyDataRef.current)
      }

      // Draw the waveform
      if (isRecording) {
        drawRecordingWaveform(canvasCtx, containerWidth, height, colors)
      } else {
        drawPlaybackWaveform(canvasCtx, containerWidth, height, colors)
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    // Start the draw loop
    draw()
  }

  const drawRecordingWaveform = (
    canvasCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colors: WaveformColors,
  ) => {
    if (!dataArrayRef.current && audioBufferRef.current.length === 0) return

    // Draw from stored audio buffer for historical data
    const combinedBuffer = combineAudioBuffers()

    // Calculate the center line position
    const centerY = height / 2

    // Draw center reference line
    canvasCtx.beginPath()
    canvasCtx.moveTo(0, centerY)
    canvasCtx.lineTo(width, centerY)
    canvasCtx.strokeStyle = colors.gridColor
    canvasCtx.lineWidth = 1
    canvasCtx.stroke()

    // Use thin lines for detailed visualization
    const lineWidth = 1
    const spacing = 0
    const totalLines = Math.floor(width / (lineWidth + spacing))
    const samplesPerLine = Math.max(1, Math.floor(combinedBuffer.length / totalLines))

    // Draw detailed waveform
    canvasCtx.strokeStyle = colors.waveformColor
    canvasCtx.lineWidth = 1

    // Use path for better performance
    canvasCtx.beginPath()

    for (let i = 0; i < totalLines; i++) {
      // Calculate peak amplitude for this segment
      let peakPositive = 0
      let peakNegative = 0
      let count = 0

      for (let j = 0; j < samplesPerLine; j++) {
        const dataIndex = i * samplesPerLine + j
        if (dataIndex < combinedBuffer.length) {
          const value = combinedBuffer[dataIndex]
          peakPositive = Math.max(peakPositive, value)
          peakNegative = Math.min(peakNegative, value)
          count++
        }
      }

      // Use peak values for more accurate medical visualization
      const x = i * (lineWidth + spacing)

      // Draw line from peak negative to peak positive, centered on the canvas
      const negativeY = centerY + (peakNegative * height) / 3
      const positiveY = centerY + (peakPositive * height) / 3

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
        const y = centerY + (v - 1) * centerY

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

  const drawPlaybackWaveform = (
    canvasCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colors: WaveformColors,
  ) => {
    if (audioBufferRef.current.length === 0) return

    // Draw from stored audio buffer
    const combinedBuffer = combineAudioBuffers()

    // Calculate the center line position
    const centerY = height / 2

    // Draw center reference line
    canvasCtx.beginPath()
    canvasCtx.moveTo(0, centerY)
    canvasCtx.lineTo(width, centerY)
    canvasCtx.strokeStyle = colors.gridColor
    canvasCtx.lineWidth = 1
    canvasCtx.stroke()

    // Use thin lines for detailed visualization
    const lineWidth = 1
    const spacing = 0
    const totalLines = Math.floor(width / (lineWidth + spacing))
    const samplesPerLine = Math.max(1, Math.floor(combinedBuffer.length / totalLines))

    // Calculate playback progress
    const playbackProgress = audioDuration > 0 ? playbackTime / audioDuration : 0
    const progressX = width * playbackProgress

    // Draw detailed waveform
    canvasCtx.lineWidth = 1

    // Draw the waveform in two parts: played and unplayed
    for (let part = 0; part < 2; part++) {
      // First part: already played (highlighted)
      // Second part: not yet played (normal color)
      canvasCtx.strokeStyle = part === 0 ? colors.playbackColor : colors.waveformColor
      canvasCtx.beginPath()

      for (let i = 0; i < totalLines; i++) {
        const x = i * (lineWidth + spacing)

        // Skip drawing if this part doesn't include this x position
        if ((part === 0 && x > progressX) || (part === 1 && x <= progressX)) {
          continue
        }

        // Calculate peak amplitude for this segment
        let peakPositive = 0
        let peakNegative = 0

        for (let j = 0; j < samplesPerLine; j++) {
          const dataIndex = i * samplesPerLine + j
          if (dataIndex < combinedBuffer.length) {
            const value = combinedBuffer[dataIndex]
            peakPositive = Math.max(peakPositive, value)
            peakNegative = Math.min(peakNegative, value)
          }
        }

        // Draw line from peak negative to peak positive, centered on the canvas
        const negativeY = centerY + (peakNegative * height) / 3
        const positiveY = centerY + (peakPositive * height) / 3

        canvasCtx.moveTo(x, negativeY)
        canvasCtx.lineTo(x, positiveY)
      }

      canvasCtx.stroke()
    }

    // Draw playback position indicator
    if (isPlaying) {
      canvasCtx.strokeStyle = colors.playbackColor
      canvasCtx.lineWidth = 2
      canvasCtx.beginPath()
      canvasCtx.moveTo(progressX, 0)
      canvasCtx.lineTo(progressX, height)
      canvasCtx.stroke()
    }

    // Draw playback progress bar at the bottom
    canvasCtx.fillStyle = `${colors.playbackColor}40` // 25% opacity
    canvasCtx.fillRect(0, height - 4, progressX, 4)
  }

  // Combine all audio buffers into a single array for visualization
  const combineAudioBuffers = (): Float32Array => {
    // If no buffers, return empty array
    if (audioBufferRef.current.length === 0) {
      return new Float32Array(0)
    }

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

  return {
    canvasRef,
    drawWaveform,
    cleanupVisualization,
    setAudioBuffer: (buffer: Float32Array[]) => {
      audioBufferRef.current = buffer
    },
  }
}
