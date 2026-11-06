from typing import Any, Literal, cast

from django.db.models import QuerySet

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from posthog.api.routing import TeamAndOrgViewSetMixin
from posthog.api.shared import UserBasicSerializer
from posthog.models.user import User
from posthog.permissions import AccessControlPermission, APIScopePermission, TeamMemberAccessPermission

from products.experiments.backend.models.experiment import Experiment
from products.experiments.backend.models.experiment_variant_annotation import ExperimentVariantAnnotation


class ExperimentVariantAnnotationListQuerySerializer(serializers.Serializer):
    experiment_id = serializers.IntegerField(
        required=False, min_value=1, help_text="Restrict annotations to this experiment in the current project."
    )


class ExperimentVariantAnnotationParentAccessControlPermission(AccessControlPermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        annotation_view = cast(GenericViewSet, view)
        if annotation_view.action != "create":
            return super().has_permission(request, view)

        # Annotation creation edits an existing experiment, so specific parent grants apply.
        annotation_view.action = "partial_update"
        try:
            return super().has_permission(request, view)
        finally:
            annotation_view.action = "create"


class ExperimentVariantAnnotationSerializer(serializers.ModelSerializer):
    experiment = serializers.IntegerField(
        source="experiment_id",
        min_value=1,
        help_text="Experiment that owns the annotation. Cannot change after creation.",
    )
    variant_key = serializers.CharField(max_length=400, help_text="Key of a variant belonging to this experiment.")
    content = serializers.CharField(max_length=2000, help_text="Plain-text annotation content, up to 2000 characters.")
    created_by = UserBasicSerializer(read_only=True, allow_null=True, help_text="User who wrote the annotation.")

    class Meta:
        model = ExperimentVariantAnnotation
        fields = ["id", "experiment", "variant_key", "content", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
        extra_kwargs = {
            "id": {"help_text": "Unique annotation identifier."},
            "created_at": {"help_text": "Time the annotation was created."},
            "updated_at": {"help_text": "Time the annotation was last edited."},
        }

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = self.instance
        if instance and attrs.get("experiment_id", instance.experiment_id) != instance.experiment_id:
            raise serializers.ValidationError({"experiment": "An annotation cannot be moved to another experiment."})

        team = self.context["get_team"]()
        experiment_id = attrs.get("experiment_id", instance.experiment_id if instance else None)
        experiment = get_object_or_404(
            Experiment.objects.select_related("feature_flag"), pk=experiment_id, team_id=team.id, deleted=False
        )
        self.context["view"].check_object_permissions(self.context["request"], experiment)

        if not instance or attrs.get("variant_key", instance.variant_key) != instance.variant_key:
            variants = experiment.feature_flag.variants if experiment.feature_flag else []
            variant_keys = {variant.get("key") for variant in variants if isinstance(variant, dict)}
            if attrs.get("variant_key") not in variant_keys:
                raise serializers.ValidationError({"variant_key": "Select a variant that belongs to this experiment."})
        return attrs


@extend_schema_view(
    list=extend_schema(
        parameters=[ExperimentVariantAnnotationListQuerySerializer],
        description="List variant annotations for experiments the user can access in this project.",
    ),
    create=extend_schema(description="Create an author-attributed annotation for a variant of an experiment."),
    retrieve=extend_schema(description="Retrieve a variant annotation from an accessible experiment."),
    update=extend_schema(description="Edit an annotation authored by the current user."),
    partial_update=extend_schema(description="Edit an annotation authored by the current user."),
    destroy=extend_schema(description="Delete an annotation authored by the current user."),
)
class ExperimentVariantAnnotationViewSet(TeamAndOrgViewSetMixin, viewsets.ModelViewSet):
    scope_object: Literal["experiment"] = "experiment"
    serializer_class = ExperimentVariantAnnotationSerializer
    queryset = ExperimentVariantAnnotation.objects.unscoped().none()

    def dangerously_get_permissions(self) -> list[BasePermission]:
        if self.action != "create":
            raise NotImplementedError()
        return [
            IsAuthenticated(),
            APIScopePermission(),
            ExperimentVariantAnnotationParentAccessControlPermission(),
            TeamMemberAccessPermission(),
        ]

    def safely_get_queryset(
        self, queryset: QuerySet[ExperimentVariantAnnotation]
    ) -> QuerySet[ExperimentVariantAnnotation]:
        queryset = ExperimentVariantAnnotation.objects.for_team(self.team_id).select_related("experiment", "created_by")
        experiments = self.user_access_control.filter_queryset_by_access_level(
            Experiment.objects.filter(team_id=self.team_id, deleted=False), resource="experiment"
        )
        queryset = queryset.filter(experiment_id__in=experiments.values("id"))
        if self.action == "list":
            query = ExperimentVariantAnnotationListQuerySerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            if experiment_id := query.validated_data.get("experiment_id"):
                queryset = queryset.filter(experiment_id=experiment_id)
        return queryset

    def safely_get_object(self, queryset: QuerySet[ExperimentVariantAnnotation]) -> ExperimentVariantAnnotation:
        annotation = get_object_or_404(queryset, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, annotation.experiment)
        if self.action in {"update", "partial_update", "destroy"}:
            user = self.request.user
            if not isinstance(user, User) or annotation.created_by_id != user.pk:
                raise PermissionDenied("You can only edit or delete your own annotations.")
        return annotation

    def perform_create(self, serializer: serializers.BaseSerializer[Any]) -> None:
        user = self.request.user
        if not isinstance(user, User):
            raise PermissionDenied("Annotations require an authenticated user.")
        serializer.save(team=self.team, created_by=user)
