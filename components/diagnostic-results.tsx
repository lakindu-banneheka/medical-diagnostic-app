import { CheckCircle2, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DiagnosticResultsProps {
  results: {
    status: "healthy" | "unhealthy"
    confidence: number
  }
}

export function DiagnosticResults({ results }: DiagnosticResultsProps) {
  const isHealthy = results.status === "healthy"

  return (
    <Card
      className={cn(
        "mt-6 border-l-4 transition-all",
        isHealthy ? "border-l-[#2ECC71] bg-[#2ECC71]/5" : "border-l-[#FF6B6B] bg-[#FF6B6B]/5",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className={cn("p-2 rounded-full", isHealthy ? "bg-[#2ECC71]/10" : "bg-[#FF6B6B]/10")}>
            {isHealthy ? (
              <CheckCircle2 className="h-6 w-6 text-[#2ECC71]" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-[#FF6B6B]" />
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-medium text-lg">{isHealthy ? "Healthy" : "Unhealthy"}</h3>
            <p className="text-sm text-gray-500">Diagnostic result with {results.confidence}% confidence</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Confidence</span>
            <span className="text-sm font-medium">{results.confidence}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn("h-2 rounded-full", isHealthy ? "bg-[#2ECC71]" : "bg-[#FF6B6B]")}
              style={{ width: `${results.confidence}%` }}
            />
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {isHealthy
              ? "The audio sample indicates normal respiratory patterns. No concerning sounds detected."
              : "The audio sample contains patterns that may indicate respiratory abnormalities. Consider consulting a healthcare professional."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
