#!/bin/bash

# Forward execution to build-windows-exe.sh
SCRIPT_DIR="$(dirname "$0")"
bash "$SCRIPT_DIR/build-windows-exe.sh" "$@"
