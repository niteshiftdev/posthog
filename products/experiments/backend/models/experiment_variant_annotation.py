from django.db import models

from posthog.models.scoping.root_mixin import TeamScopedRootMixin


class ExperimentVariantAnnotation(TeamScopedRootMixin):
    team = models.ForeignKey("posthog.Team", on_delete=models.CASCADE, db_constraint=False)
    experiment = models.ForeignKey("experiments.Experiment", on_delete=models.CASCADE)
    variant_key = models.CharField(max_length=400)
    content = models.TextField(max_length=2000)
    created_by = models.ForeignKey(
        "posthog.User", on_delete=models.SET_NULL, null=True, blank=True, db_constraint=False, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["team", "experiment", "variant_key"], name="exp_variant_annotation_lookup"),
        ]
