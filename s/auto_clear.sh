#!/data/data/com.termux/files/usr/bin/bash
FILE="$HOME/.bashrc"
CMD='clear'
if [ -f "$FILE" ]; then
    grep -q "$CMD" "$FILE" || echo "$CMD" >> "$FILE"
fi
