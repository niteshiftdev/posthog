import EXPERIMENT from '~/mocks/fixtures/api/experiments/experiment_with_multiple_metrics.json'
import { ExperimentMetric, ExperimentMetricType, NodeKind } from '~/queries/schema/schema-general'
import { Experiment, ExperimentStatus } from '~/types'

import { getPortfolioMetrics, groupPortfolioExperiments } from './portfolioUtils'

const metric: ExperimentMetric = {
    kind: NodeKind.ExperimentMetric,
    metric_type: ExperimentMetricType.MEAN,
    uuid: 'inline',
    source: { kind: NodeKind.EventsNode, event: 'uploaded_file' },
}

describe('experiment portfolio', () => {
    it('selects an ordered shared primary metric ahead of inline metrics and excludes secondary metrics', () => {
        const experiment = {
            ...EXPERIMENT,
            metrics: [metric],
            primary_metrics_ordered_uuids: ['shared', 'inline'],
            saved_metrics: [
                { name: 'Shared primary', query: { ...metric, uuid: 'shared' }, metadata: { type: 'primary' } },
                { name: 'Secondary', query: { ...metric, uuid: 'secondary' }, metadata: { type: 'secondary' } },
            ],
        } as unknown as Experiment

        expect(getPortfolioMetrics(experiment).map(({ uuid, name }) => ({ uuid, name }))).toEqual([
            { uuid: 'shared', name: 'Shared primary' },
            { uuid: 'inline', name: undefined },
        ])
    })

    it('retains metrics missing from stale ordering metadata', () => {
        const experiment = {
            ...EXPERIMENT,
            metrics: [metric],
            primary_metrics_ordered_uuids: ['removed-metric'],
            saved_metrics: [],
        } as unknown as Experiment

        expect(getPortfolioMetrics(experiment)).toEqual([metric])
    })

    it('keeps paused and frozen experiments separate from running experiments', () => {
        const experiments = [ExperimentStatus.Paused, ExperimentStatus.Running, ExperimentStatus.ExposureFrozen].map(
            (status, index) => ({ ...EXPERIMENT, id: index + 1, status }) as unknown as Experiment
        )

        expect(
            groupPortfolioExperiments(experiments).map(({ status, experiments: group }) => ({
                status,
                ids: group.map(({ id }) => id),
            }))
        ).toEqual([
            { status: ExperimentStatus.Running, ids: [2] },
            { status: ExperimentStatus.Paused, ids: [1] },
            { status: ExperimentStatus.ExposureFrozen, ids: [3] },
        ])
    })
})
