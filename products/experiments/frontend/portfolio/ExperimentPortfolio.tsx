import { useValues } from 'kea'

import { LemonBadge, LemonSkeleton, LemonTag } from '@posthog/lemon-ui'

import { getExperimentStatusColor, getExperimentStatusLabel } from 'scenes/experiments/experimentsLogic'

import { Experiment } from '~/types'

import { ExperimentPortfolioCard } from './ExperimentPortfolioCard'
import { experimentPortfolioLogic } from './experimentPortfolioLogic'

export function ExperimentPortfolio({
    experiments,
    loading,
    error,
}: {
    experiments: Experiment[]
    loading: boolean
    error?: string | null
}): JSX.Element {
    const { groups, metricStates, experimentDetails } = useValues(experimentPortfolioLogic({ experiments }))

    if (loading) {
        return (
            <div aria-label="Loading experiment portfolio">
                <LemonSkeleton className="h-64" />
            </div>
        )
    }
    if (error) {
        return (
            <div className="border rounded p-6 text-danger">
                Could not load experiments. Refresh the page to try again.
            </div>
        )
    }
    if (!experiments.length) {
        return <div className="border rounded p-6 text-secondary text-center">No experiments match your filters.</div>
    }

    return (
        <div className="space-y-6" data-attr="experiment-portfolio">
            <p className="text-secondary text-sm m-0">
                First primary metric and variant performance for experiments on this page.
            </p>
            {groups.map(({ status, experiments: group }) => (
                <section key={status} aria-label={`${getExperimentStatusLabel(status)} experiments`}>
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="m-0 text-base">
                            <LemonTag type={getExperimentStatusColor(status)}>
                                {getExperimentStatusLabel(status)}
                            </LemonTag>
                        </h2>
                        <LemonBadge.Number count={group.length} maxDigits={4} />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {group.map((experiment) => (
                            <ExperimentPortfolioCard
                                key={experiment.id}
                                experiment={experiment}
                                metricStates={metricStates}
                                detailState={
                                    experimentDetails[experiment.id] === undefined
                                        ? 'loading'
                                        : experimentDetails[experiment.id] === null
                                          ? 'error'
                                          : 'loaded'
                                }
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}
