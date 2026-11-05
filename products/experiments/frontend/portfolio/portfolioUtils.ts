import { getExperimentStatus } from 'scenes/experiments/experimentStatus'
import { getOrderedMetricsWithResults } from 'scenes/experiments/utils'

import { ExperimentMetric, NodeKind } from '~/queries/schema/schema-general'
import { Experiment, ExperimentStatus } from '~/types'

export const PORTFOLIO_STATUSES = [
    ExperimentStatus.Running,
    ExperimentStatus.Paused,
    ExperimentStatus.ExposureFrozen,
    ExperimentStatus.Draft,
    ExperimentStatus.Stopped,
]

export function getPortfolioMetrics(experiment: Experiment): Experiment['metrics'] {
    const inlineMetrics = experiment.metrics || []
    const sharedMetrics = (experiment.saved_metrics || [])
        .filter((metric) => metric.metadata?.type === 'primary')
        .map((metric) => ({ ...metric.query, name: metric.name })) as ExperimentMetric[]
    const allMetrics = [...inlineMetrics, ...sharedMetrics]
    const ordered = getOrderedMetricsWithResults(
        {
            ...experiment,
            primary_metrics_ordered_uuids: [
                ...(experiment.primary_metrics_ordered_uuids || []),
                ...allMetrics
                    .map((metric) => metric.uuid)
                    .filter(
                        (uuid): uuid is string => !!uuid && !experiment.primary_metrics_ordered_uuids?.includes(uuid)
                    ),
            ],
        },
        [],
        [],
        [],
        [],
        false
    ).map(({ metric }) => metric)
    return [...ordered, ...allMetrics.filter((metric) => !metric.uuid)]
}

export function getPortfolioMetricKey(experiment: Experiment, metric: ExperimentMetric): string {
    return `${experiment.id}:${metric.uuid}`
}

export function groupPortfolioExperiments(
    experiments: Experiment[]
): { status: ExperimentStatus; experiments: Experiment[] }[] {
    return PORTFOLIO_STATUSES.map((status) => ({
        status,
        experiments: experiments.filter((experiment) => getExperimentStatus(experiment) === status),
    })).filter((group) => group.experiments.length > 0)
}

export function isPortfolioMetric(metric: Experiment['metrics'][number]): metric is ExperimentMetric {
    return metric.kind === NodeKind.ExperimentMetric && !!metric.uuid
}
