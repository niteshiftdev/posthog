import type { Meta, StoryObj } from '@storybook/react'

import { dashboardsLogic } from 'scenes/dashboard/dashboards/dashboardsLogic'

import { BulkDeleteDashboardsModal } from './BulkDeleteDashboardsModal'

const meta: Meta<typeof BulkDeleteDashboardsModal> = {
    component: BulkDeleteDashboardsModal,
    title: 'Products/Dashboards/Bulk deletion',
    parameters: { layout: 'fullscreen' },
}

export default meta

type Story = StoryObj<typeof BulkDeleteDashboardsModal>

export const Confirmation: Story = {
    play: () => dashboardsLogic.actions.showBulkDeleteModal([1, 2, 3]),
}

export const DeleteInsights: Story = {
    play: () => {
        dashboardsLogic.actions.showBulkDeleteModal([1, 2, 3])
        dashboardsLogic.actions.setBulkDeleteInsights(true)
    },
}
