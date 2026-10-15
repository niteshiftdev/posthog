import { useActions, useValues } from 'kea'

import { LemonButton, LemonCheckbox, LemonModal } from '@posthog/lemon-ui'

import { pluralize } from 'lib/utils/strings'
import { dashboardsLogic } from 'scenes/dashboard/dashboards/dashboardsLogic'

export function BulkDeleteDashboardsModal(): JSX.Element {
    const { bulkDeleteIds, bulkDeleteInsights } = useValues(dashboardsLogic)
    const { hideBulkDeleteModal, setBulkDeleteInsights, confirmBulkDelete } = useActions(dashboardsLogic)

    return (
        <LemonModal
            title={`Delete ${pluralize(bulkDeleteIds.length, 'dashboard')}?`}
            isOpen={bulkDeleteIds.length > 0}
            onClose={hideBulkDeleteModal}
            footer={
                <>
                    <LemonButton type="secondary" onClick={hideBulkDeleteModal}>
                        Cancel
                    </LemonButton>
                    <LemonButton
                        type="primary"
                        status="danger"
                        onClick={confirmBulkDelete}
                        disabledReason={bulkDeleteIds.length === 0 ? 'No dashboards selected' : undefined}
                        data-attr="dashboards-bulk-delete-confirm"
                    >
                        Delete dashboards
                    </LemonButton>
                </>
            }
        >
            <p>The selected dashboards will be deleted. Dashboards you cannot edit will be skipped.</p>
            <LemonCheckbox
                checked={bulkDeleteInsights}
                onChange={setBulkDeleteInsights}
                label="Also delete insights on these dashboards"
                data-attr="dashboards-bulk-delete-insights"
            />
            <p className="text-secondary mt-2 mb-0">Insights on dashboards that are not deleted will be kept.</p>
        </LemonModal>
    )
}
