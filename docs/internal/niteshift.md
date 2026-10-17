# Niteshift development environment

The `.niteshift/setup` script installs dependencies and migrates the development databases.
Long-running services are declared in `.niteshift/services.yaml`.

Setup raises the inotify watch and instance limits when the sandbox exposes those kernel controls.
gVisor does not expose them, so setup leaves its limits unchanged and continues.
Failures to update an available control still stop setup.
