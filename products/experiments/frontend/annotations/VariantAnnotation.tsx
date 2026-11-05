import { LemonButton, LemonTag } from '@posthog/lemon-ui'

import { TZLabel } from 'lib/components/TZLabel'
import { dayjs } from 'lib/dayjs'

import type { ExperimentVariantAnnotationApi } from 'products/experiments/frontend/generated/api.schemas'

export function VariantAnnotation({
    annotation,
    canEdit,
    mutating,
    onEdit,
    onDelete,
}: {
    annotation: ExperimentVariantAnnotationApi
    canEdit: boolean
    mutating: boolean
    onEdit: () => void
    onDelete: () => void
}): JSX.Element {
    const author = annotation.created_by

    return (
        <article className="border rounded p-3 space-y-2" data-attr="experiment-variant-annotation">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <LemonTag>{annotation.variant_key}</LemonTag>
                    <span className="font-medium">{author?.first_name || author?.email || 'Deleted user'}</span>
                    <span className="text-secondary">
                        <TZLabel time={annotation.created_at} />
                    </span>
                    {dayjs(annotation.updated_at).isAfter(dayjs(annotation.created_at)) && (
                        <span className="text-secondary">
                            Edited <TZLabel time={annotation.updated_at} />
                        </span>
                    )}
                </div>
                {canEdit && (
                    <div className="flex gap-1">
                        <LemonButton
                            type="tertiary"
                            size="xsmall"
                            onClick={onEdit}
                            disabledReason={mutating ? 'An annotation is being saved or deleted.' : undefined}
                            data-attr={`experiment-annotation-edit-${annotation.id}`}
                        >
                            Edit
                        </LemonButton>
                        <LemonButton
                            type="tertiary"
                            status="danger"
                            size="xsmall"
                            onClick={onDelete}
                            disabledReason={mutating ? 'An annotation is being saved or deleted.' : undefined}
                            data-attr={`experiment-annotation-delete-${annotation.id}`}
                        >
                            Delete
                        </LemonButton>
                    </div>
                )}
            </div>
            <p className="m-0 whitespace-pre-wrap break-words">{annotation.content}</p>
        </article>
    )
}
