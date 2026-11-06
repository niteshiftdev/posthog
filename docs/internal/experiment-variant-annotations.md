# Experiment variant annotations

Open an existing experiment's **Metrics** tab and use **Variant annotations** below the results to record a note about a specific variant. Select the variant, enter up to 2,000 characters, and save the annotation.

Annotations show their author, creation time, and last edit time. An author with edit access to the experiment can edit or delete their annotations. Users with read access can view annotations for that experiment. Project and experiment access checks apply to every API request.

Edit access to the selected experiment allows annotation creation even when the user cannot create experiments. Authors can edit historical annotations after a variant is removed or renamed, keeping the original variant key. Selecting a different key requires a variant that still belongs to the experiment.

Annotations are separate from the experiment's recorded conclusion and from the existing variant description notes on the **Variants** tab. Adding an annotation does not ship a variant or change the experiment's feature flag.

## API

Project-scoped CRUD endpoints live under `/api/projects/{project_id}/experiment_variant_annotations/`. Filter the list with `experiment_id`.

Create an annotation with an experiment ID, a `variant_key` belonging to that experiment, and plain-text `content`. The server sets the author and timestamps. An annotation cannot move to another experiment after creation.

The Django serializer defines the schema for generated API clients and types under `products/experiments/frontend/generated/`.

## Persistence and services

The `ExperimentVariantAnnotation` model stores the project, experiment, variant key, content, author, and timestamps in Postgres. The additive `experiments` migration creates its table and lookup index. The model uses a fail-closed team-scoped manager.

The frontend uses the existing Django API and Postgres database. Annotation operations do not require ClickHouse queries or background workers. Existing experiment result queries continue through their existing path.
