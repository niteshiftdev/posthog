import { LemonButton, LemonCard, LemonSkeleton, LemonTag, Link, Tooltip } from '@posthog/lemon-ui'

import { CONCLUSION_DISPLAY_CONFIG } from 'scenes/experiments/constants'
import { getExperimentStatusColor, getExperimentStatusLabel } from 'scenes/experiments/experimentsLogic'
import { getExperimentStatus } from 'scenes/experiments/experimentStatus'
import { getExperimentVariants } from 'scenes/experiments/utils'
import { urls } from 'scenes/urls'

import { Experiment, ExperimentStatus } from '~/types'

import { PortfolioMetricState } from './experimentPortfolioLogic'
import { PortfolioMetricResults } from './PortfolioMetricResults'
import { getPortfolioMetricKey, getPortfolioMetrics, isPortfolioMetric } from './portfolioUtils'

export function ExperimentPortfolioCard({
    experiment,
    metricStates,
    detailState,
}: {
    experiment: Experiment
    metricStates: Record<string, PortfolioMetricState>
    detailState: 'loading' | 'loaded' | 'error'
}): JSX.Element {
    const status = getExperimentStatus(experiment)
    const metrics = getPortfolioMetrics(experiment).slice(0, 1)
    const variants = getExperimentVariants(experiment)
    const conclusion =
        status === ExperimentStatus.Stopped && experiment.conclusion
            ? CONCLUSION_DISPLAY_CONFIG[experiment.conclusion]
            : null

    return (
        <LemonCard hoverEffect={false} className="flex flex-col gap-4 min-w-0" data-attr="experiment-portfolio-card">
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                    <h3 className="m-0 text-base break-words">
                        <Link to={urls.experiment(experiment.id)} data-attr="experiment-portfolio-name">
                            {experiment.name}
                        </Link>
                    </h3>
                    <div className="text-secondary text-xs mt-1 break-all">{experiment.feature_flag_key}</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                    <LemonTag type={getExperimentStatusColor(status)}>{getExperimentStatusLabel(status)}</LemonTag>
                    {conclusion && (
                        <Tooltip title={conclusion.description}>
                            <LemonTag type="default">{conclusion.title}</LemonTag>
                        </Tooltip>
                    )}
                </div>
            </div>
            {experiment.description && (
                <p className="text-secondary text-sm m-0 line-clamp-2">{experiment.description}</p>
            )}
            <div className="space-y-4 flex-1">
                {detailState === 'loading' ? (
                    <LemonSkeleton className="h-24" />
                ) : detailState === 'error' ? (
                    <p className="text-secondary text-sm m-0">
                        Could not load metrics. Open the experiment to try again.
                    </p>
                ) : (
                    <>
                        {status === ExperimentStatus.Draft && (
                            <p className="text-secondary text-sm m-0">
                                Results will be available after this experiment launches.
                            </p>
                        )}
                        {metrics.length ? (
                            metrics.map((metric, index) => (
                                <PortfolioMetricResults
                                    key={metric.uuid || index}
                                    metric={metric}
                                    state={
                                        isPortfolioMetric(metric)
                                            ? metricStates[getPortfolioMetricKey(experiment, metric)]
                                            : undefined
                                    }
                                    draft={status === ExperimentStatus.Draft}
                                />
                            ))
                        ) : (
                            <p className="text-secondary text-sm m-0">
                                No primary metrics configured. Open the experiment to add a metric.
                            </p>
                        )}
                    </>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex flex-wrap items-center gap-1">
                    {variants.map((variant) => (
                        <LemonTag key={variant.key} size="small">
                            {variant.key}
                        </LemonTag>
                    ))}
                </div>
                <LemonButton
                    type="secondary"
                    size="small"
                    to={urls.experiment(experiment.id)}
                    data-attr="experiment-portfolio-open"
                >
                    Open experiment
                </LemonButton>
            </div>
        </LemonCard>
    )
}
