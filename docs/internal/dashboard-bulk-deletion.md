# Delete dashboards in bulk

In the dashboards list, select up to 100 dashboards and choose **Delete selected**.
Confirm the deletion in the dialog. You can also delete insights on those dashboards.
Insights on any dashboard that is kept, including a skipped dashboard, are kept.

Each request shows its own progress and result toast. You can leave the list while a
request runs. The result includes the number deleted and the IDs and reasons for skips.
If the request fails, the app reloads every page of the list to show the saved state.
When deletion empties the current list, the dashboard setup screen is shown, even if
other dashboards exist outside the current filters.

## API

Send `POST /api/projects/{project_id}/dashboards/bulk_delete/` with a JSON body:

```json
{ "ids": [1, 2], "delete_insights": false }
```

The endpoint requires `dashboard:write`. It accepts 1 to 100 IDs and processes each
distinct ID once. Each dashboard uses the same soft-delete, activity log, and analytics
behavior as a single-dashboard deletion. Hard deletion is not supported.

```json
{ "deleted": [1], "skipped": [{ "id": 2, "reason": "permission_denied" }] }
```

`permission_denied` means the user cannot edit the dashboard. `not_found` means the
dashboard does not exist, was already deleted, or is outside the current project.
The response is JSON. An empty batch or a batch with more than 100 IDs returns 400.
One `dashboards bulk deleted` analytics event records the request and result counts.

## MCP

Use `dashboards-bulk-delete` with the same `ids` and optional `delete_insights` values.
The tool requires the `dashboard:write` scope and returns the API result.
