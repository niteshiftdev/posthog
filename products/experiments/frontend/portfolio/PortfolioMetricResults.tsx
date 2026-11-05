import { LemonSkeleton, LemonTable, LemonTableColumns, LemonTag, Tooltip } from '@posthog/lemon-ui'

import {
    ExperimentVariantResult,
    formatChanceToWinForGoal,
    formatDeltaPercent,
    formatMetricValue,
    formatPValue,
    getDefaultMetricTitle,
    getValidationFailureType,
    getVariantInterval,
    isBayesianResult,
    isSignificant,
    isWinning,
} from 'scenes/experiments/MetricsView/shared/utils'

import { ExperimentStatsBaseValidated, NodeKind, isExperimentRatioMetric } from '~/queries/schema/schema-general'
import { Experiment } from '~/types'

import { PortfolioMetricState } from './experimentPortfolioLogic'
import { isPortfolioMetric } from './portfolioUtils'

export function PortfolioMetricResults({
    metric,
    state,
    draft,
}: {
    metric: Experiment['metrics'][number]
    state?: PortfolioMetricState
    draft: boolean
}): JSX.Element {
    const title =
        metric.name ||
        (metric.kind === NodeKind.ExperimentMetric ? getDefaultMetricTitle(metric) : 'Legacy primary metric')

    if (draft) {
        return <div className="text-sm font-medium">{title}</div>
    }

    if (!isPortfolioMetric(metric)) {
        return (
            <div className="space-y-1">
                <h4 className="m-0 text-sm">{title}</h4>
                <p className="text-secondary text-sm m-0">
                    {metric.kind === NodeKind.ExperimentMetric
                        ? 'Results are not available yet. Open the experiment for details.'
                        : 'Open the experiment to view legacy metric results.'}
                </p>
            </div>
        )
    }

    if (!state) {
        return (
            <div className="space-y-2" aria-label={`Loading results for ${title}`}>
                <h4 className="m-0 text-sm">{title}</h4>
                <LemonSkeleton className="h-16" />
            </div>
        )
    }

    if (state.status !== 'loaded') {
        return (
            <div className="space-y-1">
                <h4 className="m-0 text-sm">{title}</h4>
                <p className="text-secondary text-sm m-0">
                    {state.status === 'error'
                        ? 'Could not load results. Open the experiment to try again.'
                        : 'Results are not available yet. Open the experiment for details.'}
                </p>
            </div>
        )
    }

    const { result } = state
    const baselineInvalid = getValidationFailureType(result.baseline)
    const bayesian = result.variant_results[0] && isBayesianResult(result.variant_results[0])
    const columns: LemonTableColumns<ExperimentStatsBaseValidated | ExperimentVariantResult> = [
        {
            title: 'Variant',
            key: 'variant',
            render: (_, variant) => (
                <div className="flex flex-wrap items-center gap-1">
                    <span className="font-medium break-all">{variant.key}</span>
                    {variant.key === result.baseline.key && <LemonTag size="small">Baseline</LemonTag>}
                </div>
            ),
        },
        {
            title: 'Value',
            key: 'value',
            render: (_, variant) =>
                variant.number_of_samples > 0 &&
                Number.isFinite(variant.number_of_samples) &&
                Number.isFinite(variant.sum) &&
                (!isExperimentRatioMetric(metric) ||
                    (Number.isFinite(variant.denominator_sum) && (variant.denominator_sum ?? 0) > 0))
                    ? formatMetricValue(variant, metric)
                    : 'Unavailable',
        },
        {
            title: 'Change',
            key: 'change',
            tooltip: 'Relative change compared with the baseline. Positive change means a higher metric value.',
            render: (_, variant) => {
                if (!('method' in variant)) {
                    return '-'
                }
                const variantInvalid = getValidationFailureType(variant)
                if (baselineInvalid || variantInvalid) {
                    return (
                        <span className="text-secondary">
                            {baselineInvalid === 'error' || variantInvalid === 'error'
                                ? 'Unavailable'
                                : 'Not enough data'}
                        </span>
                    )
                }
                const interval = getVariantInterval(variant)
                if (!interval || !interval.every(Number.isFinite)) {
                    return <span className="text-secondary">Unavailable</span>
                }
                const outcome = isWinning(variant, metric.goal) ? 'improvement' : 'regression'
                return (
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="tabular-nums">{formatDeltaPercent(variant)}</span>
                        {isSignificant(variant) && (
                            <Tooltip title={`Statistically significant ${outcome} for this metric's goal.`}>
                                <LemonTag size="small" type={isWinning(variant, metric.goal) ? 'success' : 'danger'}>
                                    Significant
                                </LemonTag>
                            </Tooltip>
                        )}
                    </div>
                )
            },
        },
        {
            title: bayesian ? 'Chance to win' : 'p-value',
            key: 'evidence',
            tooltip: bayesian
                ? 'Probability that this variant improves the metric, accounting for its goal.'
                : 'Statistical evidence for a difference from the baseline.',
            render: (_, variant) => {
                if (!('method' in variant) || baselineInvalid || getValidationFailureType(variant)) {
                    return '-'
                }
                if (isBayesianResult(variant)) {
                    return Number.isFinite(variant.chance_to_win)
                        ? formatChanceToWinForGoal(variant, metric.goal)
                        : 'Unavailable'
                }
                return Number.isFinite(variant.p_value) ? formatPValue(variant.p_value) : 'Unavailable'
            },
        },
    ]

    return (
        <div className="space-y-2">
            <h4 className="m-0 text-sm">{title}</h4>
            <LemonTable
                dataSource={[result.baseline, ...result.variant_results]}
                columns={columns}
                rowKey="key"
                size="small"
                embedded
            />
        </div>
    )
}
