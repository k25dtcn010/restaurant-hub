import { useCallback, useRef } from "react"

/**
 * Custom hook for playing notification sounds using Web Audio API
 * Generates a pleasant notification beep sound programmatically
 */
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize AudioContext lazily (on first play attempt)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  /**
   * Play a notification sound
   * Generates a two-tone beep: 800Hz followed by 1000Hz
   */
  const playSound = useCallback(() => {
    try {
      const audioContext = getAudioContext()

      // First beep: 800Hz
      const oscillator1 = audioContext.createOscillator()
      const gainNode1 = audioContext.createGain()

      oscillator1.type = "sine"
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime)

      gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode1.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1
      )

      oscillator1.connect(gainNode1)
      gainNode1.connect(audioContext.destination)

      oscillator1.start(audioContext.currentTime)
      oscillator1.stop(audioContext.currentTime + 0.1)

      // Second beep: 1000Hz (slightly higher pitch)
      const oscillator2 = audioContext.createOscillator()
      const gainNode2 = audioContext.createGain()

      oscillator2.type = "sine"
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime + 0.15)

      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15)
      gainNode2.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3
      )

      oscillator2.connect(gainNode2)
      gainNode2.connect(audioContext.destination)

      oscillator2.start(audioContext.currentTime + 0.15)
      oscillator2.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.error("Error playing notification sound:", error)
    }
  }, [getAudioContext])

  return { playSound }
}
