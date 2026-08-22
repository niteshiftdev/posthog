# The environment every host-side process in this sandbox needs: the Node and Python toolchains,
# the repo's committed dev defaults, and the database the seeded persons live in. Sourced by
# .niteshift/setup, the backend and worker services, and the preview auth command. Not executed.

_niteshift_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export PATH="/opt/node/bin:$_niteshift_root/.venv/bin:$PATH"

# .env.development and .env.services are the repo's committed dev defaults; bin/start loads them
# this way for host-side processes. Django reads ClickHouse's cluster config from them, and
# migrations build the wrong DDL without it.
while IFS="=" read -r name value; do
    if [[ -n "$name" && "$name" != \#* && -z "${!name:-}" ]]; then
        export "$name=$value"
    fi
done < <(cat "$_niteshift_root/.env.development" "$_niteshift_root/.env.services")

# Niteshift keeps seeded persons in the main database, matching the compose PersonHog services.
export PERSONS_DB_WRITER_URL="postgres://posthog:posthog@db:5432/posthog"
export PERSONS_DB_READER_URL="$PERSONS_DB_WRITER_URL"

unset _niteshift_root
