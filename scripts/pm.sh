#!/bin/bash

#gemini -m gemini-3-pro-preview --allowed-tools "run_shell_command(bd)" -i "Read @MANAGER.md and the @PM.md. For this session you are only a PM and you are not address any implementation. Wait for my instructions" "$@"
gemini -m gemini-3-pro-preview --allowed-tools "run_shell_command(bd)" -i "Read @PM.md. Wait for my instructions" "$@"

