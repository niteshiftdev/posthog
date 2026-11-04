import { useEffect, useState } from 'react'

const PIECE_COUNT = 120
const BURST_MS = 14500

interface Piece {
    id: number
    left: number
    size: number
    delay: number
    duration: number
    drift: number
    spin: number
}

function makePieces(): Piece[] {
    return Array.from({ length: PIECE_COUNT }, (_, id) => ({
        id,
        left: Math.random() * 100,
        size: 22 + Math.random() * 30,
        delay: Math.random() * 7,
        duration: 3.5 + Math.random() * 3,
        drift: (Math.random() - 0.5) * 220,
        spin: (Math.random() - 0.5) * 720,
    }))
}

export function HedgehogConfetti(): JSX.Element | null {
    const [burst, setBurst] = useState<{ key: number; pieces: Piece[] } | null>(null)

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const fire = (): void => {
            clearTimeout(timer)
            setBurst({ key: Date.now(), pieces: makePieces() })
            timer = setTimeout(() => setBurst(null), BURST_MS)
        }
        ;(window as any).__hedgehogConfetti = fire
        fire()
        return () => {
            clearTimeout(timer)
            delete (window as any).__hedgehogConfetti
        }
    }, [])

    if (!burst) {
        return null
    }

    return (
        <div key={burst.key} className="HedgehogConfetti" aria-hidden>
            {burst.pieces.map((p) => (
                <span
                    key={p.id}
                    className="HedgehogConfetti__piece"
                    // eslint-disable-next-line react/forbid-dom-props
                    style={
                        {
                            left: `${p.left}%`,
                            fontSize: `${p.size}px`,
                            animationDelay: `${p.delay}s`,
                            animationDuration: `${p.duration}s`,
                            '--drift': `${p.drift}px`,
                            '--spin': `${p.spin}deg`,
                        } as React.CSSProperties
                    }
                >
                    🦔
                </span>
            ))}
        </div>
    )
}
