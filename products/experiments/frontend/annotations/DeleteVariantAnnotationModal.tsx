import { LemonBanner, LemonButton, LemonModal, LemonTag } from '@posthog/lemon-ui'

import type { ExperimentVariantAnnotationApi } from 'products/experiments/frontend/generated/api.schemas'

export function DeleteVariantAnnotationModal({
    annotation,
    deleting,
    error,
    onCancel,
    onDelete,
}: {
    annotation: ExperimentVariantAnnotationApi
    deleting: boolean
    error: string | null
    onCancel: () => void
    onDelete: () => void
}): JSX.Element {
    return (
        <LemonModal
            title="Delete this annotation?"
            onClose={deleting ? undefined : onCancel}
            closable={!deleting}
            footer={
                <>
                    <LemonButton
                        type="secondary"
                        onClick={onCancel}
                        disabledReason={deleting ? 'Deleting annotation.' : undefined}
                    >
                        Cancel
                    </LemonButton>
                    <LemonButton
                        type="primary"
                        status="danger"
                        onClick={onDelete}
                        loading={deleting}
                        data-attr="experiment-annotation-confirm-delete"
                    >
                        Delete annotation
                    </LemonButton>
                </>
            }
        >
            <div className="space-y-3">
                <LemonTag>{annotation.variant_key}</LemonTag>
                <p className="whitespace-pre-wrap break-words">{annotation.content}</p>
                <p className="text-secondary">This annotation will be permanently deleted.</p>
                {error && <LemonBanner type="error">{error}</LemonBanner>}
            </div>
        </LemonModal>
    )
}
