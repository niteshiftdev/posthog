import { MOCK_DEFAULT_TEAM } from 'lib/api.mock'

import { expectLogic } from 'kea-test-utils'

import { lemonToast } from 'lib/lemon-ui/LemonToast/LemonToast'
import { teamLogic } from 'scenes/teamLogic'

import { useMocks } from '~/mocks/jest'
import { initKeaTests } from '~/test/init'
import { AccessControlLevel, DashboardBasicType } from '~/types'

import { dashboardsBulkDeleteCreate } from 'products/dashboards/frontend/generated/api'

import { dashboardsModel, mergeTileTextUpdatesIntoDashboard, nameCompareFunction } from './dashboardsModel'

jest.mock('products/dashboards/frontend/generated/api', () => ({ dashboardsBulkDeleteCreate: jest.fn() }))

const dashboards: Partial<DashboardBasicType>[] = [
    {
        id: 1,
        name: 'Generated Dashboard: 123',
    },
    {
        id: 2,
        name: 'Generated Dashboard: 456',
    },
    {
        id: 3,
        name: 'Dashboard: 789',
    },
    {
        id: 4,
        name: 'Generated Dashboard: 101',
    },
    {
        id: 5,
        name: 'Dashboard: 112',
    },
    {
        id: 6,
        name: 'Dashboard: 131',
    },
    {
        id: 7,
    },
    {
        id: 8,
        name: 'k',
    },
    {
        id: 9,
        name: 'Pinned Later',
        pinned: true,
        last_viewed_at: '2024-05-02T12:00:00Z',
    },
    {
        id: 10,
        name: 'Pinned Never',
        pinned: true,
        last_viewed_at: null,
    },
    {
        id: 11,
        name: 'Pinned Earlier',
        pinned: true,
        last_viewed_at: '2024-04-30T12:00:00Z',
    },
]

const basicDashboard: DashboardBasicType = {
    id: 1,
    name: '',
    description: 'This is not a generated dashboard',
    pinned: false,
    created_at: new Date().toISOString(),
    created_by: null,
    last_accessed_at: null,
    last_viewed_at: null,
    is_shared: false,
    deleted: false,
    creation_mode: 'default',
    user_access_level: AccessControlLevel.Editor,
}

describe('the dashboards model', () => {
    let logic: ReturnType<typeof dashboardsModel.build>

    beforeEach(async () => {
        jest.mocked(dashboardsBulkDeleteCreate).mockReset()
        useMocks({
            get: {
                '/api/environments/:team_id/dashboards/': () => {
                    return [
                        200,
                        {
                            count: dashboards.length,
                            results: dashboards,
                            next: undefined,
                        },
                    ]
                },
            },
        })

        initKeaTests()
        logic = dashboardsModel()
        logic.mount()
    })

    it('keeps overlapping deletions independent and completes after the list unmounts', async () => {
        await expectLogic(logic).toDispatchActions(['loadDashboardsSuccess'])
        type Result = Awaited<ReturnType<typeof dashboardsBulkDeleteCreate>>
        let finishFirst!: (result: Result) => void
        let finishSecond!: (result: Result) => void
        jest.mocked(dashboardsBulkDeleteCreate)
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finishFirst = resolve
                    })
            )
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finishSecond = resolve
                    })
            )
        const pending = jest.spyOn(lemonToast, 'loading')
        const success = jest.spyOn(lemonToast, 'success')
        const warning = jest.spyOn(lemonToast, 'warning')
        const remove = jest.spyOn(lemonToast, 'dismiss')

        logic.actions.bulkDeleteDashboards([3], false)
        logic.actions.bulkDeleteDashboards([5, 6], true)
        logic.unmount()
        expect(logic.isMounted()).toBe(true)
        expect(logic.values.bulkDeletingDashboardIds).toEqual([3, 5, 6])
        expect(pending).toHaveBeenCalledTimes(2)
        expect(pending.mock.calls[0][1]?.toastId).not.toEqual(pending.mock.calls[1][1]?.toastId)

        await expectLogic(logic, () => {
            finishSecond({ deleted: [5], skipped: [{ id: 6, reason: 'permission_denied' }] })
        }).toDispatchActions(['bulkDeleteDashboardsSuccess'])
        expect(logic.values.nameSortedDashboards.some((d) => d.id === 5)).toBe(false)
        expect(logic.values.nameSortedDashboards.some((d) => d.id === 6)).toBe(true)
        expect(logic.values.bulkDeletingDashboardIds).toEqual([3])
        expect(warning).toHaveBeenCalledWith(expect.stringContaining('1 skipped'), expect.anything())

        await expectLogic(logic, () => {
            finishFirst({ deleted: [3], skipped: [] })
        }).toDispatchActions(['bulkDeleteDashboardsSuccess'])
        expect(logic.values.nameSortedDashboards.some((d) => d.id === 3)).toBe(false)
        expect(logic.values.bulkDeletingDashboardIds).toEqual([])
        expect(success).toHaveBeenCalledWith(expect.stringMatching(/1\s+dashboard deleted/), expect.anything())
        expect(remove).toHaveBeenCalledTimes(2)
        jest.restoreAllMocks()
    })

    it('replaces the model from every page after a request fails', async () => {
        await expectLogic(logic).toDispatchActions(['loadDashboardsSuccess'])
        jest.mocked(dashboardsBulkDeleteCreate).mockRejectedValue(new Error('Request failed'))
        useMocks({
            get: {
                '/api/environments/:team_id/dashboards/': ({ request }) => [
                    200,
                    {
                        count: 2,
                        next: new URL(request.url).searchParams.has('offset')
                            ? null
                            : '/api/environments/997/dashboards/?offset=1',
                        results: [dashboards[new URL(request.url).searchParams.has('offset') ? 5 : 4]],
                    },
                ],
            },
        })

        await expectLogic(logic, () => logic.actions.bulkDeleteDashboards([3], false)).toDispatchActions([
            'bulkDeleteDashboardsFailure',
            'dashboardsReloaded',
        ])
        expect(Object.keys(logic.values.rawDashboards).sort()).toEqual(['5', '6'])
        expect(logic.values.bulkDeletingDashboardIds).toEqual([])
    })

    it('does not let a stale list response restore a deleted dashboard', async () => {
        await expectLogic(logic).toDispatchActions(['loadDashboardsSuccess'])
        logic.actions.bulkDeleteDashboardsSuccess([3], { deleted: [3], skipped: [] })
        logic.actions.loadDashboardsSuccess({
            results: dashboards as DashboardBasicType[],
            count: dashboards.length,
            next: null,
            previous: null,
        })
        logic.actions.dashboardsReloaded(dashboards as DashboardBasicType[])
        expect(logic.values.nameSortedDashboards.some((d) => d.id === 3)).toBe(false)
    })

    it('removes missing dashboards while keeping permission skips', async () => {
        await expectLogic(logic).toDispatchActions(['loadDashboardsSuccess'])
        logic.actions.bulkDeleteDashboardsSuccess([3, 5], {
            deleted: [],
            skipped: [
                { id: 3, reason: 'not_found' },
                { id: 5, reason: 'permission_denied' },
            ],
        })
        expect(logic.values.nameSortedDashboards.some((d) => d.id === 3)).toBe(false)
        expect(logic.values.nameSortedDashboards.some((d) => d.id === 5)).toBe(true)
    })

    describe('sorting dashboards', () => {
        it('can sort dashboards correctly', async () => {
            await expectLogic(logic, () => {
                logic.actions.loadDashboards()
            })
                .toDispatchActions(['loadDashboardsSuccess'])
                .toMatchValues({
                    nameSortedDashboards: [
                        {
                            id: 11,
                            last_viewed_at: '2024-04-30T12:00:00Z',
                            name: 'Pinned Earlier',
                            pinned: true,
                        },
                        {
                            id: 9,
                            last_viewed_at: '2024-05-02T12:00:00Z',
                            name: 'Pinned Later',
                            pinned: true,
                        },
                        {
                            id: 10,
                            last_viewed_at: null,
                            name: 'Pinned Never',
                            pinned: true,
                        },
                        {
                            id: 5,
                            name: 'Dashboard: 112',
                        },
                        {
                            id: 6,
                            name: 'Dashboard: 131',
                        },
                        {
                            id: 3,
                            name: 'Dashboard: 789',
                        },
                        {
                            id: 8,
                            name: 'k',
                        },
                        {
                            id: 7,
                        },
                    ],
                })
        })

        it('compares names correctly', async () => {
            const generatedDashboardA = { ...basicDashboard, id: 1, name: 'Generated Dashboard: XYZ' }
            const untitledDashboard = { ...basicDashboard, id: 2, name: 'Untitled' }
            const randomDashboard = { ...basicDashboard, id: 3, name: 'Random' }
            const randomDashboard2 = { ...basicDashboard, id: 3, name: 'Too Random' }
            expect(nameCompareFunction(generatedDashboardA, untitledDashboard)).toEqual(-1)
            expect(nameCompareFunction(untitledDashboard, generatedDashboardA)).toEqual(1)
            expect(nameCompareFunction(generatedDashboardA, randomDashboard)).toEqual(-1)
            expect(nameCompareFunction(randomDashboard, generatedDashboardA)).toEqual(1)
            expect(nameCompareFunction(generatedDashboardA, randomDashboard2)).toEqual(-1)
            expect(nameCompareFunction(randomDashboard2, generatedDashboardA)).toEqual(1)

            expect(nameCompareFunction(untitledDashboard, randomDashboard)).toEqual(1)
            expect(nameCompareFunction(randomDashboard, untitledDashboard)).toEqual(-1)
            expect(nameCompareFunction(untitledDashboard, randomDashboard2)).toEqual(1)
            expect(nameCompareFunction(randomDashboard2, untitledDashboard)).toEqual(-1)

            expect(nameCompareFunction(randomDashboard2, randomDashboard)).toEqual(1)
            expect(nameCompareFunction(randomDashboard, randomDashboard2)).toEqual(-1)
        })

        it('sorts pinned dashboards by last viewed time', async () => {
            await expectLogic(logic, () => {
                logic.actions.loadDashboards()
            })
                .toDispatchActions(['loadDashboardsSuccess'])
                .toMatchValues({
                    pinnedDashboards: [
                        expect.objectContaining({ id: 9 }),
                        expect.objectContaining({ id: 11 }),
                        expect.objectContaining({ id: 10 }),
                    ],
                })
        })
    })

    describe('updating folders after a move', () => {
        beforeEach(async () => {
            await expectLogic(logic, () => logic.actions.loadDashboards()).toFinishAllListeners()
        })

        it('files a dashboard at its new path, and derives the folder from it', async () => {
            logic.actions.patchDashboardFolders({ 1: 'Revenue/Q3/Growth', 2: 'At the root' })
            expect(logic.values.rawDashboards[1].file_system_path).toEqual('Revenue/Q3/Growth')
            expect(logic.values.rawDashboards[1].folder).toEqual('Revenue/Q3')
            // A dashboard at the project root has no folder above it
            expect(logic.values.rawDashboards[2].folder).toEqual('')
        })

        it('ignores ids it does not hold', async () => {
            const before = logic.values.rawDashboards
            logic.actions.patchDashboardFolders({ 99999: 'Revenue/Missing' })
            expect(logic.values.rawDashboards).toBe(before)
        })

        it('re-parents everything under a moved folder, sparing similarly named siblings', async () => {
            logic.actions.patchDashboardFolders({
                1: 'Revenue/One',
                2: 'Revenue/Q3/Two',
                3: 'Revenue archive/Three',
            })
            logic.actions.reparentDashboardFolders('Revenue', 'Finance/Revenue')
            expect(logic.values.rawDashboards[1].folder).toEqual('Finance/Revenue')
            expect(logic.values.rawDashboards[2].folder).toEqual('Finance/Revenue/Q3')
            // 'Revenue archive' merely starts with the moved folder's name, so it stays put
            expect(logic.values.rawDashboards[3].folder).toEqual('Revenue archive')
        })

        it('keeps the path in step with the folder, so a second move starts from the right place', async () => {
            logic.actions.patchDashboardFolders({ 1: 'Revenue/Growth' })
            logic.actions.reparentDashboardFolders('Revenue', 'Finance/Revenue')
            expect(logic.values.rawDashboards[1].file_system_path).toEqual('Finance/Revenue/Growth')
        })

        it('leaves the map alone when nothing sits under the moved folder', async () => {
            const before = logic.values.rawDashboards
            logic.actions.reparentDashboardFolders('Nowhere', 'Elsewhere')
            expect(logic.values.rawDashboards).toBe(before)
        })
    })

    it('clears primary_dashboard from team when deleting the primary dashboard', async () => {
        const primaryDashboardId = 42
        initKeaTests(true, { ...MOCK_DEFAULT_TEAM, primary_dashboard: primaryDashboardId })
        useMocks({
            get: {
                '/api/environments/:team_id/dashboards/': {
                    count: 0,
                    results: [],
                },
            },
            patch: {
                '/api/environments/:team_id/dashboards/:id/': {
                    id: primaryDashboardId,
                    name: 'My Dashboard',
                    deleted: true,
                },
            },
        })
        logic = dashboardsModel()
        logic.mount()

        logic.actions.deleteDashboard({ id: primaryDashboardId, deleteInsights: false })

        await expectLogic(logic).toDispatchActions(['deleteDashboardSuccess'])
        await expectLogic(teamLogic).toMatchValues({
            currentTeam: expect.objectContaining({ primary_dashboard: null }),
        })
    })

    it('does not clear primary_dashboard when deleting a non-primary dashboard', async () => {
        const primaryDashboardId = 42
        initKeaTests(true, { ...MOCK_DEFAULT_TEAM, primary_dashboard: primaryDashboardId })
        useMocks({
            get: {
                '/api/environments/:team_id/dashboards/': {
                    count: 0,
                    results: [],
                },
            },
            patch: {
                '/api/environments/:team_id/dashboards/:id/': {
                    id: 99,
                    name: 'Other Dashboard',
                    deleted: true,
                },
            },
        })
        logic = dashboardsModel()
        logic.mount()

        logic.actions.deleteDashboard({ id: 99, deleteInsights: false })

        await expectLogic(logic).toDispatchActions(['deleteDashboardSuccess'])
        await expectLogic(teamLogic).toMatchValues({
            currentTeam: expect.objectContaining({ primary_dashboard: primaryDashboardId }),
        })
    })
})

describe('mergeTileTextUpdatesIntoDashboard', () => {
    it('updates only text body and preserves server metadata', () => {
        const dashboard = {
            id: 123,
            tiles: [
                {
                    id: 1,
                    text: {
                        body: 'server body',
                        last_modified_at: '2026-03-17T10:00:00Z',
                    },
                },
            ],
        } as any

        const merged = mergeTileTextUpdatesIntoDashboard(dashboard, [
            {
                id: 1,
                text: {
                    body: 'client body',
                    last_modified_at: 'stale-client-value',
                },
            },
        ])

        expect(merged.tiles?.[0]?.text?.body).toEqual('client body')
        expect(merged.tiles?.[0]?.text?.last_modified_at).toEqual('2026-03-17T10:00:00Z')
    })
})
