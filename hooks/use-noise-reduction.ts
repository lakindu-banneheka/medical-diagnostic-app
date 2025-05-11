// "use client"

// import { useState, useRef } from "react"
// import { toast } from "@/components/ui/use-toast"
// import { blobToWavFile } from "@/utils/wav-encoder"

// interface UseNoiseReductionProps {
//   onProcessingComplete: (audioUrl: string, audioFile: File) => void
// }

// interface UseNoiseReductionReturn {
//   processAudio: (audioFile: File) => Promise<void>
//   isProcessing: boolean
//   progress: number
//   noiselessAudioUrl: string | null
//   error: string | null
//   cleanup: () => void
// }

// export function useNoiseReduction({ onProcessingComplete }: UseNoiseReductionProps): UseNoiseReductionReturn {
//   const [isProcessing, setIsProcessing] = useState(false)
//   const [progress, setProgress] = useState(0)
//   const [noiselessAudioUrl, setNoiselessAudioUrl] = useState<string | null>(null)
//   const [error, setError] = useState<string | null>(null)
//   const abortControllerRef = useRef<AbortController | null>(null)

//   // Process audio for noise reduction
//   const processAudio = async (audioFile: File) => {
//     if (isProcessing) {
//       console.log("Already processing audio, ignoring request")
//       return
//     }

//     // Clean up previous state
//     cleanup()

//     setIsProcessing(true)
//     setProgress(0)
//     setError(null)

//     // Create a new abort controller for this request
//     abortControllerRef.current = new AbortController()
//     const { signal } = abortControllerRef.current

//     try {
//       // Simulate progress updates
//       const progressInterval = setInterval(() => {
//         setProgress((prev) => {
//           // Gradually increase progress up to 90% (the last 10% is for final processing)
//           const newProgress = prev + Math.random() * 5
//           return Math.min(newProgress, 90)
//         })
//       }, 300)

//       // TODO: Replace with actual AWS endpoint
//       // This is a placeholder for the AWS noise reduction endpoint
//       // const endpoint = "https://your-aws-lambda-endpoint.amazonaws.com/noise-reduction"

//       // For now, we'll simulate the API call with a delay
//       await new Promise((resolve) => setTimeout(resolve, 3000))

//       // Simulate successful processing
//       // In a real implementation, you would:
//       // 1. Create a FormData object
//       // 2. Append the audio file
//       // 3. Send a POST request to your AWS endpoint
//       // 4. Process the response

//       /*
//       const formData = new FormData()
//       formData.append("audioFile", audioFile)
      
//       const response = await fetch(endpoint, {
//         method: "POST",
//         body: formData,
//         signal,
//       })
      
//       if (!response.ok) {
//         throw new Error(`Server responded with ${response.status}: ${response.statusText}`)
//       }
      
//       const responseData = await response.json()
//       const processedAudioUrl = responseData.audioUrl
//       */

//       // Clear the progress interval
//       clearInterval(progressInterval)

//       // Set progress to 100%
//       setProgress(100)

//       // For the simulation, we'll just use the original file but create a new WAV
//       // In a real implementation, you would download the processed file from the AWS response
//       const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
//       const noiselessFilename = `noise_reduced_${timestamp}.wav`

//       // Convert to proper WAV format (in a real implementation, this would be the downloaded file)
//       const noiselessFile = await blobToWavFile(await audioFile.arrayBuffer(), noiselessFilename)

//       // Create a URL for the processed audio
//       const audioUrl = URL.createObjectURL(noiselessFile)
//       setNoiselessAudioUrl(audioUrl)

//       // Notify completion
//       toast({
//         title: "Noise Reduction Complete",
//         description: "Background noise has been successfully removed.",
//       })

//       // Call the completion callback
//       onProcessingComplete(audioUrl, noiselessFile)
//     } catch (err) {
//       if (signal.aborted) {
//         console.log("Noise reduction was cancelled")
//         setError("Processing was cancelled")
//       } else {
//         console.error("Error processing audio for noise reduction:", err)
//         setError("Failed to process audio. Please try again.")
//         toast({
//           title: "Processing Error",
//           description: "Failed to reduce noise. Please try again.",
//           variant: "destructive",
//         })
//       }
//     } finally {
//       setIsProcessing(false)
//     }
//   }

//   // Clean up resources
//   const cleanup = () => {
//     // Abort any in-progress requests
//     if (abortControllerRef.current) {
//       abortControllerRef.current.abort()
//       abortControllerRef.current = null
//     }

//     // Revoke any object URLs to prevent memory leaks
//     if (noiselessAudioUrl) {
//       URL.revokeObjectURL(noiselessAudioUrl)
//       setNoiselessAudioUrl(null)
//     }

//     // Reset state
//     setProgress(0)
//     setError(null)
//   }

//   return {
//     processAudio,
//     isProcessing,
//     progress,
//     noiselessAudioUrl,
//     error,
//     cleanup,
//   }
// }
