#!/bin/bash
# Script to ensure root manifest.xml is always updated
# Run this after any changes to outlook-addin/manifest.xml

echo "Updating root manifest.xml..."

# Copy the latest manifest from outlook-addin to root
cp outlook-addin/manifest.xml manifest.xml

# Check if we're on gh-pages branch
if [ "$(git branch --show-current)" = "gh-pages" ]; then
    echo "On gh-pages branch - committing and pushing..."
    git add manifest.xml
    git commit -m "Auto-update root manifest.xml"
    git push origin gh-pages
    echo "✅ Root manifest.xml updated and pushed to GitHub Pages"
else
    echo "Not on gh-pages branch - just updated locally"
    echo "Run 'git checkout gh-pages && git add manifest.xml && git commit -m \"Update root manifest\" && git push origin gh-pages' to deploy"
fi

echo "✅ Root manifest.xml is now synchronized with outlook-addin/manifest.xml"
