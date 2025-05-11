/**
 * Formats seconds into a MM:SS time string
 * @param seconds - The number of seconds to format
 * @returns A formatted time string in MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`
}
