import { MOCK_DEFAULT_BASIC_USER, MOCK_DEFAULT_USER } from 'lib/api.mock'

import { expectLogic } from 'kea-test-utils'

import * as accessControlUtils from 'lib/utils/accessControlUtils'

import EXPERIMENT from '~/mocks/fixtures/api/experiments/experiment_with_multiple_metrics.json'
import { initKeaTests } from '~/test/init'
import { Experiment } from '~/types'

import * as api from 'products/experiments/frontend/generated/api'
import type { ExperimentVariantAnnotationApi } from 'products/experiments/frontend/generated/api.schemas'

import { variantAnnotationsLogic } from './variantAnnotationsLogic'

const experiment = {
    ...EXPERIMENT,
    feature_flag: {
        ...EXPERIMENT.feature_flag,
        filters: {
            ...EXPERIMENT.feature_flag.filters,
            multivariate: {
                variants: [
                    { key: 'control', rollout_percentage: 50 },
                    { key: 'test', rollout_percentage: 50 },
                ],
            },
        },
    },
} as unknown as Experiment

const historicalAnnotation: ExperimentVariantAnnotationApi = {
    id: 123,
    experiment: EXPERIMENT.id,
    variant_key: 'original-treatment',
    content: 'Keep the decision recorded against its original variant.',
    created_by: {
        ...MOCK_DEFAULT_BASIC_USER,
        id: MOCK_DEFAULT_USER.id,
        hedgehog_config: null,
        role_at_organization: null,
    },
    created_at: '2026-01-02T12:00:00Z',
    updated_at: '2026-01-02T12:00:00Z',
}

describe('variantAnnotationsLogic historical variants', () => {
    let logic: ReturnType<typeof variantAnnotationsLogic.build>

    beforeEach(async () => {
        initKeaTests()
        jest.spyOn(accessControlUtils, 'userHasAccess').mockReturnValue(true)
        jest.spyOn(api, 'experimentVariantAnnotationsList').mockResolvedValue({
            count: 1,
            results: [historicalAnnotation],
            next: null,
            previous: null,
        })
        jest.spyOn(api, 'experimentVariantAnnotationsCreate').mockResolvedValue(historicalAnnotation)
        jest.spyOn(api, 'experimentVariantAnnotationsPartialUpdate').mockResolvedValue(historicalAnnotation)
        logic = variantAnnotationsLogic({ experiment })
        await expectLogic(logic, () => {
            logic.mount()
        }).toFinishAllListeners()
    })

    afterEach(() => {
        logic.unmount()
        jest.restoreAllMocks()
    })

    it('saves an existing annotation without reassigning its removed variant', async () => {
        expect(logic.values.canEditAnnotation(historicalAnnotation)).toBe(true)
        logic.actions.editAnnotation(historicalAnnotation)
        logic.actions.setContent('Updated the explanation for the original decision.')

        expect(logic.values.variantOptions).toContainEqual({
            value: historicalAnnotation.variant_key,
            label: historicalAnnotation.variant_key,
        })
        expect(logic.values.canSubmit).toBe(true)

        await expectLogic(logic, () => logic.actions.submitAnnotation()).toFinishAllListeners()

        expect(api.experimentVariantAnnotationsPartialUpdate).toHaveBeenCalledWith(
            String(logic.values.currentProjectId),
            historicalAnnotation.id,
            {
                variant_key: historicalAnnotation.variant_key,
                content: 'Updated the explanation for the original decision.',
            }
        )
        expect(api.experimentVariantAnnotationsCreate).not.toHaveBeenCalled()
        expect(logic.values.variantOptions.map(({ value }) => value)).toEqual(['control', 'test'])
    })

    it.each([
        { editing: true, variantKey: 'another-removed-variant' },
        { editing: false, variantKey: historicalAnnotation.variant_key },
    ])('rejects an unconfigured key with editing=$editing', async ({ editing, variantKey }) => {
        if (editing) {
            logic.actions.editAnnotation(historicalAnnotation)
        }
        logic.actions.setContent('A note that must not be sent for an invalid key.')
        logic.actions.setVariantKey(variantKey)

        expect(logic.values.canSubmit).toBe(false)
        await expectLogic(logic, () => logic.actions.submitAnnotation()).toFinishAllListeners()

        expect(api.experimentVariantAnnotationsCreate).not.toHaveBeenCalled()
        expect(api.experimentVariantAnnotationsPartialUpdate).not.toHaveBeenCalled()
    })
})
