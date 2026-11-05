from freezegun import freeze_time
from posthog.test.base import APIBaseTest

from django.utils.dateparse import parse_datetime

from parameterized import parameterized

from posthog.constants import AvailableFeature
from posthog.models import OrganizationMembership, Team, User

from products.experiments.backend.models.experiment import Experiment
from products.experiments.backend.models.experiment_variant_annotation import ExperimentVariantAnnotation
from products.feature_flags.backend.models.feature_flag import FeatureFlag

from ee.models.rbac.access_control import AccessControl


class TestExperimentVariantAnnotationAPI(APIBaseTest):
    def setUp(self) -> None:
        super().setUp()
        self.experiment = self._experiment(self.team)

    def _experiment(self, team: Team, key: str = "annotation-test") -> Experiment:
        flag = FeatureFlag.objects.create(
            team=team,
            created_by=self.user,
            key=key,
            filters={
                "groups": [{"properties": [], "rollout_percentage": 100}],
                "multivariate": {
                    "variants": [
                        {"key": "control", "rollout_percentage": 50},
                        {"key": "test", "rollout_percentage": 50},
                    ]
                },
            },
        )
        return Experiment.objects.create(team=team, name="Variant notes test", feature_flag=flag, created_by=self.user)

    def _url(self, annotation_id: int | None = None) -> str:
        base = f"/api/projects/{self.team.id}/experiment_variant_annotations/"
        return f"{base}{annotation_id}/" if annotation_id is not None else base

    def _annotation(
        self, experiment: Experiment | None = None, author: User | None = None
    ) -> ExperimentVariantAnnotation:
        experiment = experiment or self.experiment
        return ExperimentVariantAnnotation.objects.for_team(experiment.team_id).create(
            team_id=experiment.team_id,
            experiment=experiment,
            variant_key="test",
            content="Reviewed the launch results.",
            created_by=author or self.user,
        )

    def test_create_read_update_and_delete_persist_author_and_timestamps(self) -> None:
        with freeze_time("2026-01-02T12:00:00Z"):
            response = self.client.post(
                self._url(),
                {"experiment": self.experiment.id, "variant_key": "test", "content": "Reviewed the launch results."},
            )
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        annotation_id = data["id"]
        self.assertEqual(data["created_by"]["id"], self.user.id)
        annotation = ExperimentVariantAnnotation.objects.for_team(self.team.id).get(pk=annotation_id)
        self.assertEqual(annotation.created_by_id, self.user.id)
        self.assertEqual(annotation.experiment_id, self.experiment.id)
        self.assertEqual(annotation.team_id, self.team.id)

        self._annotation(experiment=self._experiment(self.team, key="unrelated-annotation-test"))
        response = self.client.get(self._url(), {"experiment_id": self.experiment.id})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual([note["id"] for note in response.json()["results"]], [annotation_id])
        self.assertEqual(self.client.get(self._url(annotation_id)).json()["content"], annotation.content)

        with freeze_time("2026-01-02T13:00:00Z"):
            response = self.client.patch(self._url(annotation_id), {"content": "Confirmed after another review."})
        self.assertEqual(response.status_code, 200, response.content)
        annotation.refresh_from_db()
        self.assertEqual(annotation.content, "Confirmed after another review.")
        self.assertEqual(annotation.created_by_id, self.user.id)
        self.assertEqual(response.json()["created_at"], data["created_at"])
        updated_at = parse_datetime(response.json()["updated_at"])
        created_at = parse_datetime(data["created_at"])
        assert updated_at is not None and created_at is not None
        self.assertGreater(updated_at, created_at)

        self.assertEqual(self.client.delete(self._url(annotation_id)).status_code, 204)
        self.assertFalse(ExperimentVariantAnnotation.objects.for_team(self.team.id).filter(pk=annotation_id).exists())
        self.assertEqual(self.client.get(self._url(annotation_id)).status_code, 404)

    @parameterized.expand(
        [
            ("unknown_variant", "variant_key", "unrecognized"),
            ("blank_variant", "variant_key", ""),
            ("blank_content", "content", "   "),
            ("long_content", "content", "x" * 2001),
        ]
    )
    def test_rejects_invalid_variant_or_content(self, _name: str, field: str, value: str) -> None:
        data = {"experiment": self.experiment.id, "variant_key": "test", "content": "Ready for review."}
        data[field] = value
        response = self.client.post(self._url(), data)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response.json()["attr"], field)
        self.assertFalse(ExperimentVariantAnnotation.objects.for_team(self.team.id).exists())

    def test_rejects_invalid_variant_on_update_and_parent_reassignment(self) -> None:
        annotation = self._annotation()
        other_experiment = self._experiment(self.team, key="second-annotation-test")
        for update, field in [
            ({"variant_key": "unknown"}, "variant_key"),
            ({"experiment": other_experiment.id}, "experiment"),
        ]:
            response = self.client.patch(self._url(annotation.id), update)
            self.assertEqual(response.status_code, 400, response.content)
            self.assertEqual(response.json()["attr"], field)
        annotation.refresh_from_db()
        self.assertEqual(annotation.experiment_id, self.experiment.id)
        self.assertEqual(annotation.variant_key, "test")

    def test_client_cannot_assign_author_or_team(self) -> None:
        other_user = User.objects.create_user(
            email="other-reviewer@example.com", first_name="Reviewer", password="test-password"
        )
        other_team = Team.objects.create(organization=self.organization, name="Other project")
        response = self.client.post(
            self._url(),
            {
                "experiment": self.experiment.id,
                "variant_key": "test",
                "content": "Reviewed this variant.",
                "team": other_team.id,
                "created_by": other_user.id,
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        annotation = ExperimentVariantAnnotation.objects.for_team(self.team.id).get(pk=response.json()["id"])
        self.assertEqual(annotation.team_id, self.team.id)
        self.assertEqual(annotation.created_by_id, self.user.id)
        response = self.client.patch(self._url(annotation.id), {"created_by": other_user.id})
        self.assertEqual(response.status_code, 200, response.content)
        annotation.refresh_from_db()
        self.assertEqual(annotation.created_by_id, self.user.id)

    def test_another_author_cannot_edit_or_delete_annotation(self) -> None:
        other_user = User.objects.create_user(
            email="note-author@example.com", first_name="Author", password="test-password"
        )
        annotation = self._annotation(author=other_user)
        self.assertEqual(self.client.get(self._url(annotation.id)).status_code, 200)
        self.assertEqual(self.client.patch(self._url(annotation.id), {"content": "Changed"}).status_code, 403)
        self.assertEqual(self.client.delete(self._url(annotation.id)).status_code, 403)
        annotation.refresh_from_db()
        self.assertEqual(annotation.content, "Reviewed the launch results.")

    def test_cannot_access_annotations_or_create_for_an_experiment_in_another_project(self) -> None:
        other_team = Team.objects.create(organization=self.organization, name="Other project")
        other_experiment = self._experiment(other_team)
        annotation = self._annotation(experiment=other_experiment)
        response = self.client.get(self._url(), {"experiment_id": other_experiment.id})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["results"], [])
        self.assertEqual(self.client.get(self._url(annotation.id)).status_code, 404)
        self.assertEqual(self.client.patch(self._url(annotation.id), {"content": "Changed"}).status_code, 404)
        self.assertEqual(self.client.delete(self._url(annotation.id)).status_code, 404)
        response = self.client.post(
            self._url(), {"experiment": other_experiment.id, "variant_key": "test", "content": "Reviewed."}
        )
        self.assertEqual(response.status_code, 404, response.content)
        annotation.refresh_from_db()
        self.assertEqual(annotation.content, "Reviewed the launch results.")

    @parameterized.expand([("none", 404), ("viewer", 200)])
    def test_annotations_honor_parent_experiment_permissions(self, access_level: str, read_status: int) -> None:
        self.organization.available_product_features = [
            {"key": AvailableFeature.ACCESS_CONTROL, "name": "Access control"}
        ]
        self.organization.save()
        self.organization_membership.level = OrganizationMembership.Level.MEMBER
        self.organization_membership.save()
        other_user = User.objects.create_user(
            email="experiment-owner@example.com", first_name="Owner", password="test-password"
        )
        self.experiment.created_by = other_user
        self.experiment.save()
        annotation = self._annotation()
        AccessControl.objects.create(
            team=self.team,
            resource="experiment",
            resource_id=str(self.experiment.id),
            access_level=access_level,
            organization_member=self.organization_membership,
        )

        response = self.client.get(self._url(), {"experiment_id": self.experiment.id})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["count"], 0 if access_level == "none" else 1)
        self.assertEqual(self.client.get(self._url(annotation.id)).status_code, read_status)
        write_status = 404 if access_level == "none" else 403
        self.assertEqual(self.client.patch(self._url(annotation.id), {"content": "Changed"}).status_code, write_status)
        self.assertEqual(self.client.delete(self._url(annotation.id)).status_code, write_status)
        self.assertEqual(
            self.client.post(
                self._url(), {"experiment": self.experiment.id, "variant_key": "test", "content": "Reviewed."}
            ).status_code,
            403,
        )
