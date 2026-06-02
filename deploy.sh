#!/bin/bash
set -e
npx expo export --platform web
railway up --service train-home-app --detach
echo "✓ Geüpload naar Railway"
