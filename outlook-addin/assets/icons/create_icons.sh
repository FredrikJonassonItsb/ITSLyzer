#!/bin/bash
# Skapa placeholder-ikoner med ImageMagick eller convert

# Färger för Nextcloud
BG_COLOR="#0082c9"
TEXT_COLOR="white"

# Skapa ikoner i olika storlekar
for size in 16 32 64 128; do
  convert -size ${size}x${size} xc:${BG_COLOR} \
    -gravity center \
    -pointsize $((size/2)) \
    -fill ${TEXT_COLOR} \
    -annotate +0+0 "NC" \
    icon-${size}.png
done

echo "Ikoner skapade!"
