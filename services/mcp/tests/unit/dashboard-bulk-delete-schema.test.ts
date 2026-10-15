import { describe, expect, it } from 'vitest'

import { GENERATED_TOOLS } from '@/tools/generated/dashboards'

describe('dashboards-bulk-delete schema', () => {
    const tool = GENERATED_TOOLS['dashboards-bulk-delete']!()

    it('accepts a batch with optional insight deletion', () => {
        expect(tool.schema.parse({ ids: [1, 2], delete_insights: true })).toEqual({
            ids: [1, 2],
            delete_insights: true,
        })
        expect(tool.schema.parse({ ids: [1] }).delete_insights).toBe(false)
    })

    it.each([{ ids: [] }, { ids: Array.from({ length: 101 }, (_, i) => i + 1) }])(
        'rejects an invalid batch size',
        ({ ids }) => {
            expect(tool.schema.safeParse({ ids }).success).toBe(false)
        }
    )
})
