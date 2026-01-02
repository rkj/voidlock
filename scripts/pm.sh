#!/bin/bash

gemini -m gemini-3-pro-preview --allowed-tools "run_shell_command(bd)" "$@"

