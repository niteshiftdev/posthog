import { useActions, useValues } from 'kea'

import {
    LemonBanner,
    LemonButton,
    LemonCard,
    LemonLabel,
    LemonSelect,
    LemonSkeleton,
    LemonTextArea,
} from '@posthog/lemon-ui'

import { Experiment } from '~/types'

import { DeleteVariantAnnotationModal } from './DeleteVariantAnnotationModal'
import { VariantAnnotation } from './VariantAnnotation'
import { variantAnnotationsLogic } from './variantAnnotationsLogic'

export function VariantAnnotations({ experiment }: { experiment: Experiment }): JSX.Element {
    const logic = variantAnnotationsLogic({ experiment })
    const {
        annotations,
        annotationsLoading,
        annotationToDelete,
        canAnnotate,
        canEditAnnotation,
        canSubmit,
        content,
        editingId,
        loadFailed,
        mutationError,
        mutationLoading,
        page,
        variantKey,
        variantOptions,
    } = useValues(logic)
    const {
        cancelDelete,
        confirmDelete,
        editAnnotation,
        loadVariantAnnotations,
        resetEditor,
        setContent,
        setPage,
        setVariantKey,
        startDelete,
        submitAnnotation,
    } = useActions(logic)

    return (
        <LemonCard hoverEffect={false} className="mt-6 space-y-4" data-attr="experiment-variant-annotations">
            <div>
                <h2 className="text-lg m-0">Variant annotations</h2>
                <p className="text-secondary m-0 mt-1">
                    Record decisions and observations about a variant alongside its results.
                </p>
            </div>
            {annotationsLoading || (!loadFailed && annotations === null) ? (
                <LemonSkeleton className="h-24" />
            ) : loadFailed ? (
                <LemonBanner type="error" action={{ children: 'Try again', onClick: () => loadVariantAnnotations() }}>
                    Could not load annotations. Try again to view them.
                </LemonBanner>
            ) : annotations?.results.length ? (
                <div className="space-y-3">
                    {annotations.results.map((annotation) => (
                        <VariantAnnotation
                            key={annotation.id}
                            annotation={annotation}
                            canEdit={canEditAnnotation(annotation)}
                            mutating={mutationLoading}
                            onEdit={() => {
                                editAnnotation(annotation)
                                document
                                    .getElementById('experiment-annotation-content')
                                    ?.scrollIntoView({ block: 'center' })
                            }}
                            onDelete={() => startDelete(annotation)}
                        />
                    ))}
                    {(annotations.next || annotations.previous) && (
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-secondary text-sm">Page {page}</span>
                            <div className="flex gap-2">
                                <LemonButton
                                    type="secondary"
                                    size="small"
                                    onClick={() => setPage(page - 1)}
                                    loading={annotationsLoading}
                                    disabledReason={
                                        mutationLoading
                                            ? 'An annotation is being saved or deleted.'
                                            : !annotations.previous
                                              ? 'No previous page'
                                              : undefined
                                    }
                                >
                                    Previous
                                </LemonButton>
                                <LemonButton
                                    type="secondary"
                                    size="small"
                                    onClick={() => setPage(page + 1)}
                                    loading={annotationsLoading}
                                    disabledReason={
                                        mutationLoading
                                            ? 'An annotation is being saved or deleted.'
                                            : !annotations.next
                                              ? 'No next page'
                                              : undefined
                                    }
                                >
                                    Next
                                </LemonButton>
                            </div>
                        </div>
                    )}
                </div>
            ) : annotations !== null ? (
                <p className="text-secondary m-0">
                    {canAnnotate ? 'No annotations yet. Add a note about a variant below.' : 'No annotations yet.'}
                </p>
            ) : null}
            {canAnnotate ? (
                <form
                    className="space-y-3 border-t pt-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        submitAnnotation()
                    }}
                >
                    <h3 className="text-base m-0">{editingId === null ? 'Add annotation' : 'Edit annotation'}</h3>
                    <div className="space-y-1">
                        <LemonLabel htmlFor="experiment-annotation-variant">Variant</LemonLabel>
                        <LemonSelect
                            id="experiment-annotation-variant"
                            value={variantKey}
                            onChange={setVariantKey}
                            options={variantOptions}
                            disabledReason={
                                mutationLoading
                                    ? 'An annotation is being saved or deleted.'
                                    : !variantOptions.length
                                      ? 'This experiment has no variants.'
                                      : undefined
                            }
                            data-attr="experiment-annotation-variant"
                        />
                    </div>
                    <div className="space-y-1">
                        <LemonLabel htmlFor="experiment-annotation-content">Note</LemonLabel>
                        <LemonTextArea
                            id="experiment-annotation-content"
                            value={content}
                            onChange={setContent}
                            placeholder="Record a decision or observation about this variant"
                            maxLength={2000}
                            minRows={3}
                            disabled={mutationLoading}
                            data-attr="experiment-annotation-content"
                        />
                    </div>
                    {mutationError && !annotationToDelete && <LemonBanner type="error">{mutationError}</LemonBanner>}
                    <div className="flex items-center gap-2">
                        <LemonButton
                            type="primary"
                            htmlType="submit"
                            loading={mutationLoading && !annotationToDelete}
                            disabledReason={!canSubmit ? 'Select a variant and enter a note.' : undefined}
                            data-attr="experiment-annotation-save"
                        >
                            {editingId === null ? 'Add annotation' : 'Save annotation'}
                        </LemonButton>
                        {editingId !== null && (
                            <LemonButton
                                type="secondary"
                                onClick={resetEditor}
                                disabledReason={
                                    mutationLoading ? 'An annotation is being saved or deleted.' : undefined
                                }
                            >
                                Cancel
                            </LemonButton>
                        )}
                    </div>
                </form>
            ) : (
                <p className="text-secondary m-0">You need edit access to this experiment to add annotations.</p>
            )}
            {annotationToDelete && (
                <DeleteVariantAnnotationModal
                    annotation={annotationToDelete}
                    deleting={mutationLoading}
                    error={mutationError}
                    onCancel={cancelDelete}
                    onDelete={confirmDelete}
                />
            )}
        </LemonCard>
    )
}
