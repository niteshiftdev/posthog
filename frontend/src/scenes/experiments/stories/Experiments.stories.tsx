import { Meta, StoryObj } from '@storybook/react'

import { App } from 'scenes/App'
import { urls } from 'scenes/urls'

import { mswDecorator } from '~/mocks/browser'
import EXPERIMENT_DRAFT from '~/mocks/fixtures/api/experiments/_experiment_draft.json'
import EXPERIMENT_WITH_LEGACY_FUNNELS_QUERY from '~/mocks/fixtures/api/experiments/experiment_with_funnels_query.json'
import EXPERIMENT_WITH_MULTIPLE_METRICS from '~/mocks/fixtures/api/experiments/experiment_with_multiple_metrics.json'
import EXPERIMENT_WITH_LEGACY_TRENDS_QUERY from '~/mocks/fixtures/api/experiments/experiment_with_trends_query.json'
import FUNNEL_METRIC_RESULT from '~/mocks/fixtures/api/experiments/funnel_metric_result.json'
import MEAN_METRIC_RESULT from '~/mocks/fixtures/api/experiments/mean_metric_result.json'
import RATIO_METRIC_RESULT from '~/mocks/fixtures/api/experiments/ratio_metric_result.json'
import { toPaginatedResponse } from '~/mocks/handlers'
import {
    ExperimentQuery,
    isExperimentFunnelMetric,
    isExperimentMeanMetric,
    isExperimentRatioMetric,
} from '~/queries/schema/schema-general'

const meta: Meta = {
    component: App,
    title: 'Scenes-App/Experiments',
    parameters: {
        layout: 'fullscreen',
        viewMode: 'story',
        mockDate: '2025-01-27',
        pageUrl: urls.experiments(),
        testOptions: { viewport: { width: 1300, height: 2000 } },
    },
    decorators: [
        mswDecorator({
            get: {
                '/api/projects/:team_id/experiments/': toPaginatedResponse([
                    EXPERIMENT_DRAFT,
                    EXPERIMENT_WITH_LEGACY_TRENDS_QUERY,
                    EXPERIMENT_WITH_LEGACY_FUNNELS_QUERY,
                    EXPERIMENT_WITH_MULTIPLE_METRICS,
                ]),
                [`/api/projects/:team_id/experiments/${EXPERIMENT_DRAFT.id}/`]: EXPERIMENT_DRAFT,
                [`/api/projects/:team_id/experiments/${EXPERIMENT_WITH_LEGACY_TRENDS_QUERY.id}/`]:
                    EXPERIMENT_WITH_LEGACY_TRENDS_QUERY,
                [`/api/projects/:team_id/experiments/${EXPERIMENT_WITH_LEGACY_FUNNELS_QUERY.id}/`]:
                    EXPERIMENT_WITH_LEGACY_FUNNELS_QUERY,
                [`/api/projects/:team_id/experiments/${EXPERIMENT_WITH_MULTIPLE_METRICS.id}/`]:
                    EXPERIMENT_WITH_MULTIPLE_METRICS,
                '/api/projects/:team_id/experiment_holdouts': [],
                '/api/projects/:team_id/experiment_saved_metrics/': [],
            },
            post: {
                '/api/environments/:team_id/query/:kind': async ({ request }) => {
                    const { query } = (await request.json()) as { query: ExperimentQuery }

                    if (isExperimentFunnelMetric(query.metric)) {
                        return [200, FUNNEL_METRIC_RESULT]
                    }
                    if (isExperimentMeanMetric(query.metric)) {
                        return [200, MEAN_METRIC_RESULT]
                    }
                    if (isExperimentRatioMetric(query.metric)) {
                        return [200, RATIO_METRIC_RESULT]
                    }
                    return [400, { detail: 'Unsupported metric' }]
                },
            },
        }),
    ],
}
export default meta
type Story = StoryObj<{}>

export const Experiments: Story = {}

export const Portfolio: Story = {
    parameters: {
        pageUrl: `${urls.experiments()}?view=portfolio`,
    },
}
