import { Meta, StoryObj } from '@storybook/react'

import { mswDecorator } from '~/mocks/browser'
import EXPERIMENT from '~/mocks/fixtures/api/experiments/experiment_with_multiple_metrics.json'
import { toPaginatedResponse } from '~/mocks/handlers'
import { Experiment } from '~/types'

import type { ExperimentVariantAnnotationApi } from 'products/experiments/frontend/generated/api.schemas'

import { VariantAnnotations } from './VariantAnnotations'

const annotation: ExperimentVariantAnnotationApi = {
    id: 1,
    experiment: EXPERIMENT.id,
    variant_key: 'test',
    content: 'Reviewed this variant with the team. Keep the rollout steady while gathering more evidence.',
    created_by: {
        id: 1,
        uuid: '00000000-0000-4000-8000-000000000001',
        email: 'alex@example.com',
        first_name: 'Alex',
        hedgehog_config: null,
    },
    created_at: '2026-01-20T12:00:00Z',
    updated_at: '2026-01-20T12:00:00Z',
}

const meta: Meta<typeof VariantAnnotations> = {
    title: 'Products/Experiments/Variant annotations',
    component: VariantAnnotations,
    args: { experiment: EXPERIMENT as unknown as Experiment },
    parameters: { mockDate: '2026-01-21T12:00:00Z' },
    decorators: [
        mswDecorator({
            get: {
                '/api/projects/:project_id/experiment_variant_annotations/': toPaginatedResponse([annotation]),
            },
        }),
    ],
}
export default meta
type Story = StoryObj<typeof VariantAnnotations>

export const WithAnnotations: Story = {}

export const Empty: Story = {
    decorators: [
        mswDecorator({
            get: {
                '/api/projects/:project_id/experiment_variant_annotations/': toPaginatedResponse([]),
            },
        }),
    ],
}
