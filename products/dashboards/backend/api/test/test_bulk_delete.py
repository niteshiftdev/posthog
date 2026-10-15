from posthog.test.base import APIBaseTest
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from parameterized import parameterized

from posthog.constants import AvailableFeature
from posthog.models import Team, User
from posthog.models.activity_logging.activity_log import ActivityLog

from products.dashboards.backend.api.dashboard import DashboardBulkDeleteRequestSerializer
from products.dashboards.backend.models.dashboard import Dashboard
from products.dashboards.backend.models.dashboard_tile import DashboardTile
from products.product_analytics.backend.facade.models import Insight

from ee.models.rbac.access_control import AccessControl


class TestBulkDeleteValidation(SimpleTestCase):
    @parameterized.expand([([],), (list(range(1, 102)),)])
    def test_batch_size(self, ids: list[int]) -> None:
        serializer = DashboardBulkDeleteRequestSerializer(data={"ids": ids})
        self.assertFalse(serializer.is_valid())
        self.assertIn("ids", serializer.errors)


class TestDashboardBulkDelete(APIBaseTest):
    def test_bulk_delete_and_activity_log(self) -> None:
        dashboards = [Dashboard.objects.create(team=self.team, name=f"Dashboard {i}") for i in range(2)]
        self.team.primary_dashboard = dashboards[0]
        self.team.save()
        response = self.client.post(
            f"/api/projects/{self.team.id}/dashboards/bulk_delete/", {"ids": [d.id for d in dashboards]}
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json(), {"deleted": [d.id for d in dashboards], "skipped": []})
        self.assertEqual(response["Content-Type"], "application/json")
        self.team.refresh_from_db()
        self.assertIsNone(self.team.primary_dashboard_id)
        for dashboard in dashboards:
            dashboard.refresh_from_db()
            self.assertTrue(dashboard.deleted)
            entry = ActivityLog.objects.filter(scope="Dashboard", item_id=str(dashboard.id), activity="deleted").get()
            self.assertEqual(entry.user_id, self.user.id)

    @patch("products.dashboards.backend.api.dashboard.report_user_action")
    def test_duplicates_and_bulk_analytics(self, report: MagicMock) -> None:
        dashboards = [Dashboard.objects.create(team=self.team, name=f"Dashboard {i}") for i in range(2)]
        response = self.client.post(
            f"/api/projects/{self.team.id}/dashboards/bulk_delete/",
            {"ids": [dashboards[0].id, dashboards[1].id, dashboards[0].id]},
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["deleted"], [d.id for d in dashboards])
        self.assertEqual([call.args[1] for call in report.call_args_list].count("dashboard deleted"), 2)
        bulk_calls = [call for call in report.call_args_list if call.args[1] == "dashboards bulk deleted"]
        self.assertEqual(len(bulk_calls), 1)
        self.assertEqual(
            bulk_calls[0].args[2],
            {"requested_count": 2, "deleted_count": 2, "skipped_count": 0, "delete_insights": False},
        )

    def test_missing_and_other_project_ids_are_skipped(self) -> None:
        other_team = Team.objects.create(organization=self.organization)
        foreign = Dashboard.objects.create(team=other_team, name="Other project")
        dashboard = Dashboard.objects.create(team=self.team, name="This project")
        response = self.client.post(
            f"/api/projects/{self.team.id}/dashboards/bulk_delete/", {"ids": [foreign.id, 999999999, dashboard.id]}
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(
            response.json(),
            {
                "deleted": [dashboard.id],
                "skipped": [{"id": foreign.id, "reason": "not_found"}, {"id": 999999999, "reason": "not_found"}],
            },
        )
        foreign.refresh_from_db()
        self.assertFalse(foreign.deleted)

    @parameterized.expand([([],), (list(range(1, 102)),)])
    def test_invalid_batch_returns_400(self, ids: list[int]) -> None:
        response = self.client.post(f"/api/projects/{self.team.id}/dashboards/bulk_delete/", {"ids": ids})
        self.assertEqual(response.status_code, 400)

    @parameterized.expand([("legacy",), ("rbac",)])
    def test_permission_skips_keep_shared_insights(self, permission_system: str) -> None:
        member = User.objects.create_and_join(self.organization, "member@example.com", None)
        self.organization.available_product_features = [
            {"key": AvailableFeature.ACCESS_CONTROL, "name": "Access control"}
        ]
        self.organization.save(update_fields=["available_product_features"])
        AccessControl.objects.create(
            team=self.team, resource="project", resource_id=str(self.team.id), access_level="member"
        )
        self.client.force_login(member)
        allowed = Dashboard.objects.create(team=self.team, name="Editable", created_by=member)
        denied = Dashboard.objects.create(
            team=self.team,
            name="Restricted",
            created_by=self.user,
            restriction_level=(
                Dashboard.RestrictionLevel.ONLY_COLLABORATORS_CAN_EDIT
                if permission_system == "legacy"
                else Dashboard.RestrictionLevel.EVERYONE_IN_PROJECT_CAN_EDIT
            ),
        )
        if permission_system == "rbac":
            AccessControl.objects.create(
                team=self.team,
                resource="dashboard",
                resource_id=str(denied.id),
                access_level="viewer",
                organization_member=member.organization_memberships.get(organization=self.organization),
            )
        shared = Insight.objects.create(team=self.team, name="Shared")
        for dashboard in [allowed, denied]:
            DashboardTile.objects.create(team=self.team, dashboard=dashboard, insight=shared)
        response = self.client.post(
            f"/api/projects/{self.team.id}/dashboards/bulk_delete/",
            {"ids": [allowed.id, denied.id], "delete_insights": True},
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(
            response.json(), {"deleted": [allowed.id], "skipped": [{"id": denied.id, "reason": "permission_denied"}]}
        )
        denied.refresh_from_db()
        shared.refresh_from_db()
        self.assertFalse(denied.deleted)
        self.assertFalse(shared.deleted)

    @parameterized.expand([(False,), (True,)])
    def test_optional_insight_deletion(self, delete_insights: bool) -> None:
        first, second, kept = [Dashboard.objects.create(team=self.team, name=str(i)) for i in range(3)]
        batch_shared, outside_shared, exclusive = [
            Insight.objects.create(team=self.team, name=str(i)) for i in range(3)
        ]
        for dashboard, insight in [
            (first, batch_shared),
            (second, batch_shared),
            (first, outside_shared),
            (kept, outside_shared),
            (second, exclusive),
        ]:
            DashboardTile.objects.create(team=self.team, dashboard=dashboard, insight=insight)
        response = self.client.post(
            f"/api/projects/{self.team.id}/dashboards/bulk_delete/",
            {"ids": [first.id, second.id], "delete_insights": delete_insights},
        )
        self.assertEqual(response.status_code, 200, response.json())
        for insight in [batch_shared, exclusive]:
            insight.refresh_from_db()
            self.assertEqual(insight.deleted, delete_insights)
        outside_shared.refresh_from_db()
        self.assertFalse(outside_shared.deleted)
        self.assertFalse(DashboardTile.objects.filter(dashboard__in=[first, second]).exists())
