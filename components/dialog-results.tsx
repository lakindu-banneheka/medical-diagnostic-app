"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, AlertTriangle, Download, Share2, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DialogResultsProps {
  results: {
    status: "abnormal" | "normal" | "artifact"
    confidence: number
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DialogResults({ results, open, onOpenChange }: DialogResultsProps) {
  const [animateValue, setAnimateValue] = useState(0)

  useEffect(() => {
    if (open && results) {
      // Animate the confidence value
      const start = 0
      const end = results.confidence
      const duration = 1500
      const startTime = performance.now()

      const animateConfidence = (currentTime: number) => {
        const elapsedTime = currentTime - startTime
        const progress = Math.min(elapsedTime / duration, 1)
        const currentValue = Math.floor(progress * end)

        setAnimateValue(currentValue)

        if (progress < 1) {
          requestAnimationFrame(animateConfidence)
        }
      }

      requestAnimationFrame(animateConfidence)
    } else {
      setAnimateValue(0)
    }
  }, [open, results])

  if (!results) return null

  if (results.status == "artifact") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <span>Artifact Sounds (Not a Heart Sound)</span>
            </DialogTitle>
            <DialogDescription>
              The audio sample contains artifact sounds that are not heart sounds. Please try again with a clearer recording.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  const isHealthy = results.status === "normal"
  const statusColor = isHealthy ? "bg-green-500" : "bg-destructive"
  const statusBgColor = isHealthy ? "bg-green-500/10" : "bg-destructive/10"
  const statusBorderColor = isHealthy ? "border-green-500" : "border-destructive"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className={cn("p-2 rounded-full", statusBgColor)}>
              {isHealthy ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <span>{isHealthy ? "Normal Heart Sound" : "Abnormal Heart Sound"}</span>
          </DialogTitle>
          <DialogDescription>Diagnostic result with {results.confidence}% confidence</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Confidence</span>
              <span className="text-lg font-bold">{animateValue}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-1000 ease-out",
                  isHealthy ? "bg-green-500" : "bg-destructive",
                )}
                style={{ width: `${animateValue}%` }}
              />
            </div>
          </div>

          <div
            className={cn(
              "p-4 rounded-lg border-l-4",
              isHealthy ? "border-l-green-500 bg-green-500/5" : "border-l-destructive bg-destructive/5",
            )}
          >
            <p className="text-sm">
              {isHealthy
                ? "The audio sample indicates normal heart sounds. No murmurs detected."
                : "The audio sample contains abnormal heart sounds, which may indicate cardiac issues. Consider consulting a healthcare professional."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
              <Download className="h-3 w-3" />
              Save Report
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
              <Share2 className="h-3 w-3" />
              Share Results
            </Button>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className={cn(
              "w-full sm:w-auto flex items-center gap-1",
              isHealthy ? "bg-green-500 hover:bg-green-500/90" : "bg-destructive hover:bg-destructive/90",
            )}
          >
            {isHealthy ? "Continue" : "Consult Doctor"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
