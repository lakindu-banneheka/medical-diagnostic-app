"use client"

import { useState, useRef, useEffect } from "react"
import { blobToWavFile } from "@/utils/wav-encoder"

interface UseAudioPlaybackProps {
  audioUrl: string | null
  onPlaybackTimeUpdate?: (currentTime: number, duration: number) => void
}

interface UseAudioPlaybackReturn {
  isPlaying: boolean
  togglePlayback: () => void
  downloadRecording: () => void
}

export function useAudioPlayback({ audioUrl, onPlaybackTimeUpdate }: UseAudioPlaybackProps): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
    }
  }, [])

  // Update audio source when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl
      audioRef.current.load()
    }

    // Clean up playback state when URL changes
    setIsPlaying(false)
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
    }
  }, [audioUrl])

  // Set up event listeners for the audio element
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => {
      setIsPlaying(false)
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
        timeUpdateIntervalRef.current = null
      }
    }

    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Toggle playback
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
        timeUpdateIntervalRef.current = null
      }
    } else {
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error)
      })

      // Set up interval to report playback time
      if (onPlaybackTimeUpdate) {
        timeUpdateIntervalRef.current = setInterval(() => {
          if (audioRef.current) {
            onPlaybackTimeUpdate(audioRef.current.currentTime, audioRef.current.duration || 0)
          }
        }, 50)
      }
    }

    setIsPlaying(!isPlaying)
  }

  // Download recording as WAV
  const downloadRecording = async () => {
    if (!audioUrl) return

    try {
      // Fetch the audio blob from the URL
      const response = await fetch(audioUrl)
      const audioBlob = await response.blob()

      // Convert to proper WAV format
      const timestamp = new Date().toISOString().slice(0, 10)
      const filename = `medical_recording_${timestamp}.wav`
      const wavFile = await blobToWavFile(audioBlob, filename)

      // Create download link
      const downloadUrl = URL.createObjectURL(wavFile)
      const downloadLink = document.createElement("a")
      downloadLink.href = downloadUrl
      downloadLink.download = filename
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)

      // Clean up
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Error downloading recording:", error)
    }
  }

  return {
    isPlaying,
    togglePlayback,
    downloadRecording,
  }
}
