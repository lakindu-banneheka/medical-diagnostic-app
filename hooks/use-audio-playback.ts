"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "@/components/ui/use-toast"

interface UseAudioPlaybackProps {
  audioUrl: string | null
  onPlaybackTimeUpdate?: (time: number, duration: number) => void
}

export function useAudioPlayback({ audioUrl, onPlaybackTimeUpdate }: UseAudioPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio()

      audioElementRef.current.addEventListener("loadedmetadata", () => {
        if (audioElementRef.current) {
          const duration = audioElementRef.current.duration
          console.log("Audio loaded with duration:", duration)
          setAudioDuration(duration)
        }
      })

      audioElementRef.current.addEventListener("ended", () => {
        setIsPlaying(false)
        setPlaybackTime(0)
      })

      audioElementRef.current.addEventListener("timeupdate", () => {
        if (audioElementRef.current) {
          const currentTime = audioElementRef.current.currentTime
          const duration = audioElementRef.current.duration
          setPlaybackTime(currentTime)

          // Call the callback to update parent components
          if (onPlaybackTimeUpdate) {
            onPlaybackTimeUpdate(currentTime, duration)
          }
        }
      })

      // Add error event listener
      audioElementRef.current.addEventListener("error", (e) => {
        console.error("Audio element error:", e)
        toast({
          title: "Playback Error",
          description: "There was an error loading the audio. Please try recording again.",
          variant: "destructive",
        })
      })
    }

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.src = ""
      }
    }
  }, [onPlaybackTimeUpdate])

  // Update audio source when URL changes
  useEffect(() => {
    if (audioElementRef.current && audioUrl) {
      audioElementRef.current.src = audioUrl
      audioElementRef.current.load()
    }
  }, [audioUrl])

  const togglePlayback = () => {
    if (!audioElementRef.current || !audioUrl) return

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

  const downloadRecording = () => {
    if (!audioUrl) return

    try {
      // Create a download link
      const downloadLink = document.createElement("a")
      downloadLink.href = audioUrl

      // Use a timestamp in the filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
      downloadLink.download = `medical_recording_${timestamp}.wav`

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

  return {
    isPlaying,
    playbackTime,
    audioDuration,
    togglePlayback,
    downloadRecording,
  }
}
