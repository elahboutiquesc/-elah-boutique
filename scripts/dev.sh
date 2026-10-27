#!/usr/bin/env bash
set -euo pipefail
# Reuse the development adapter prepared by cloud environment onboarding.
# Node 24 must opt into the machine's HTTP(S)_PROXY for upstream requests.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec node --use-env-proxy /workspace/.elah-dev/server.mjs
