import clsx from 'clsx'
import { useRef } from 'react'
import { createPortal } from 'react-dom'

import { useAnimatedPresence } from 'lib/hooks/useAnimatedPresence'
import { LemonButton } from 'lib/lemon-ui/LemonButton'

import { BulkSelectionConfig, BulkSelectionContext, BulkSelectionKey } from './useBulkSelection'

export interface BulkSelectionBarProps<T extends Record<string, any>, K extends BulkSelectionKey = BulkSelectionKey> {
    context: BulkSelectionContext<T, K>
    config: BulkSelectionConfig<T, K>
    noun: [string, string]
}

export function BulkSelectionBar<T extends Record<string, any>, K extends BulkSelectionKey = BulkSelectionKey>({
    context,
    config,
    noun,
}: BulkSelectionBarProps<T, K>): JSX.Element | null {
    const barRef = useRef<HTMLDivElement>(null)
    const { rendered, shown } = useAnimatedPresence(context.selectedCount > 0, 200, barRef)
    if (!rendered) {
        return null
    }
    const [singular, plural] = noun
    const word = context.selectedCount === 1 ? singular : plural

    const bar = (
        <div
            ref={barRef}
            aria-hidden={!shown}
            {...(!shown ? { inert: '' } : {})}
            className={clsx(
                'grid transition-all duration-200 motion-reduce:transition-none LemonTable__bulk-selection-bar',
                shown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
        >
            <div className="overflow-hidden">
                <div className={clsx('flex items-center justify-end gap-2 min-h-9 px-1', config.barClassName)}>
                    <span className="text-secondary text-sm">
                        {context.selectedCount} {word} selected
                    </span>
                    <LemonButton type="secondary" size="small" onClick={context.clearSelection}>
                        Clear
                    </LemonButton>
                    {config.renderActions(context)}
                </div>
            </div>
        </div>
    )

    return config.barPortalTarget ? createPortal(bar, config.barPortalTarget) : bar
}
