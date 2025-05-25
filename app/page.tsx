"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AudioRecorder } from "@/components/audio-recorder"
import { FileUploader } from "@/components/file-uploader"
import { DialogResults } from "@/components/dialog-results"
import { Loader2, Info, AlertTriangle, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "next-themes"
import axios from "axios"
import Image from "next/image"

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<{
    status: "abnormal" | "normal" | "artifact"
    confidence: number
  } | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  const handleAudioCaptured = async (file: File) => {
    setAudioFile(file)
    await analyzeAudio(file)
  }

  const analyzeAudio = async (file: File) => {
    setIsAnalyzing(true)
    setResults(null)
    setShowResults(false)
    setApiError(null)

    try {
      // Create FormData to send the file
      const formData = new FormData()
      formData.append("audio_file", file)

      // In a real application, you would send this to your AWS Lambda endpoint
      try {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/predict`, formData, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.status !== 200) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = response.data as { label: "normal" | "abnormal" | "artifact", confidence: number};

        const results = {
          status: data.label,
          confidence: data.confidence * 100,
        } as const


        setResults(results)
        setShowResults(true)

        // Reset retry count on success
        setRetryCount(0)
      } catch (error) {
        console.error("API Error:", error)

        // Handle different types of errors
        let errorMessage = "An unexpected error occurred while analyzing your audio."

        if (error instanceof TypeError && error.message.includes("NetworkError")) {
          errorMessage = "Network error. Please check your internet connection and try again."
        } else if (error instanceof Error && error.message.includes("timeout")) {
          errorMessage = "The request timed out. Please try again."
        } else if (error instanceof Error && error.message.includes("status: 429")) {
          errorMessage = "Too many requests. Please wait a moment and try again."
        } else if (error instanceof Error && error.message.includes("status: 5")) {
          errorMessage = "Server error. Our team has been notified and is working on it."
        }

        setApiError(errorMessage)

        toast({
          title: "Analysis Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error analyzing audio:", error)
      setApiError("An unexpected error occurred. Please try again.")

      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRetry = () => {
    if (audioFile && retryCount < 3) {
      setRetryCount((prev) => prev + 1)
      analyzeAudio(audioFile)
    } else if (retryCount >= 3) {
      toast({
        title: "Too Many Attempts",
        description: "Please try again later or contact support if the issue persists.",
        variant: "destructive",
      })
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      {/* Header with theme toggle */}
      <header className="w-full border-b border-border">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Image src="./logo/logo-blue.png" alt="Logo" width={36} height={36} />
            <h1 className="text-xl font-semibold text-foreground">Medical Diagnostic</h1>
          </div>
          {/* <h1 className="text-xl font-semibold text-foreground">Medical Diagnostic</h1> */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full">
        <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6 h-full">
          {/* Left panel - App card */}
          <div className="w-full md:w-2/3 lg:w-3/4">
            <Card className="h-full shadow-sm border border-border overflow-hidden">
              <CardHeader className="relative bg-primary text-primary-foreground">
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary-foreground opacity-80 hover:opacity-100 hover:bg-primary-foreground/20"
                    onClick={() => setShowInfo(!showInfo)}
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                </div>
                <CardTitle className="text-2xl font-medium">Heart Sound Analysis</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Record or upload audio for medical diagnosis
                </CardDescription>

                {showInfo && (
                  <div className="mt-2 p-3 bg-primary-foreground/10 rounded-md text-xs">
                    <p>
                      This application uses audio processing to analyze respiratory patterns. For best
                      results:
                    </p>
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      <li>Record in a quiet environment</li>
                      <li>Hold the device 6-8 inches from your mouth</li>
                      <li>Breathe normally during recording</li>
                      <li>Complete the full 30-second recording if possible</li>
                    </ul>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0 flex-1">
                <Tabs defaultValue="record" className="w-full h-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-none">
                    <TabsTrigger value="record" className="rounded-none">
                      Record Audio
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="rounded-none">
                      Upload File
                    </TabsTrigger>
                  </TabsList>

                  <div className="p-6">
                    <TabsContent value="record" className="mt-0">
                      <AudioRecorder onAudioCaptured={handleAudioCaptured} />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-0">
                      <FileUploader onFileSelected={handleAudioCaptured} />
                    </TabsContent>
                  </div>
                </Tabs>

                {isAnalyzing && (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                    <p className="text-sm font-medium text-foreground">Analyzing audio sample...</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Our AI is processing your recording to detect respiratory patterns
                    </p>
                  </div>
                )}

                {apiError && !isAnalyzing && (
                  <div className="p-6">
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Analysis Failed</AlertTitle>
                      <AlertDescription>{apiError}</AlertDescription>
                    </Alert>

                    <div className="flex justify-center gap-3">
                      <Button variant="outline" onClick={() => setApiError(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleRetry} disabled={retryCount >= 3}>
                        Retry Analysis
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel - Info and history */}
          <div className="w-full md:w-1/3 lg:w-1/4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This medical diagnostic tool uses advanced audio analysis to detect potential respiratory issues.
                </p>
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium mb-2">Features:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• High-quality audio recording</li>
                    {/* <li>• Medical-grade analysis</li> */}
                    <li>• Download recordings</li>
                    <li>• Instant results</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            
            <Card
              className="bg-secondary text-secondary-foreground shadow-sm border border-border"
              style={{ minHeight: "150px" }}
            >
              <CardHeader>
                <CardTitle className="text-lg">Disclaimer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This is an AI prediction for research purposes only. Please consult healthcare professionals for medical advice.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>
            © 2025 Medical Diagnostic App •{" "}
            <a href="#" className="text-primary hover:underline">
              Privacy Policy
            </a>{" "}
            •{" "}
            <a href="#" className="text-primary hover:underline">
              Terms of Use
            </a>
          </p>
        </div>
      </footer>

      {/* Results Dialog */}
      <DialogResults results={results} open={showResults} onOpenChange={setShowResults} />
    </div>
  )
}
