"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, File, X, Loader2, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface FileUploaderProps {
  onFileSelected: (file: File) => void
}

export function FileUploader({ onFileSelected }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const validateAndSetFile = (file: File) => {
    setError(null)

    // Check file type
    if (file.type !== "audio/wav" && file.type !== "audio/x-wav") {
      setError("Please select a WAV file")
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit")
      return
    }

    // Check file duration (would require additional processing in a real app)
    // For this example, we'll just accept the file

    setSelectedFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 200)

    // Simulate processing delay
    setTimeout(() => {
      clearInterval(interval)
      setUploadProgress(100)

      setTimeout(() => {
        onFileSelected(selectedFile)
        setIsUploading(false)
        setSelectedFile(null)
        setUploadProgress(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }, 500)
    }, 2000)

    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(100)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      {!selectedFile && !isUploading && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            error ? "border-destructive bg-destructive/5" : "",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {error ? (
            <>
              <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-2" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-destructive/80 mt-1">Please try again with a valid WAV file</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click or drag file to upload</p>
              <p className="text-xs text-muted-foreground mt-1">WAV files only (max 10MB, 30 seconds)</p>
            </>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/wav"
            className="hidden"
            aria-label="Upload audio file"
          />
        </div>
      )}

      {selectedFile && !isUploading && (
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary p-2 rounded-md">
                <File className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[180px]">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelectedFile}
              className="h-8 w-8"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={handleUpload} className="w-full mt-4">
            Analyze Audio
          </Button>
        </div>
      )}

      {isUploading && (
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center space-x-3 mb-3">
            <div className="bg-primary p-2 rounded-md">
              <File className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium truncate">{selectedFile?.name}</p>
              <Progress value={uploadProgress} className="h-2 mt-1" />
            </div>
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            {uploadProgress < 100 ? "Uploading..." : "Processing..."}
          </p>
        </div>
      )}
    </div>
  )
}
