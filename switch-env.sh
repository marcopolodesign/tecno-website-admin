#!/bin/bash

# Script to switch between staging and production environments

ENV=$1

if [ -z "$ENV" ]; then
  echo "Usage: ./switch-env.sh [staging|production]"
  echo ""
  echo "Current environment files:"
  if [ -f .env ]; then
    echo "  .env exists"
    if grep -q "tmuazbkketrrnmtkzfjd" .env 2>/dev/null; then
      echo "  → Currently using STAGING"
    elif grep -q "buntxbgjixlksffbscle" .env 2>/dev/null; then
      echo "  → Currently using PRODUCTION"
    else
      echo "  → Unknown environment"
    fi
  else
    echo "  .env does not exist"
  fi
  echo ""
  echo "Available environments:"
  [ -f .env.staging ] && echo "  ✅ staging (.env.staging exists)" || echo "  ❌ staging (.env.staging missing)"
  [ -f .env.production ] && echo "  ✅ production (.env.production exists)" || echo "  ❌ production (.env.production missing)"
  exit 1
fi

case $ENV in
  staging)
    if [ ! -f .env.staging ]; then
      echo "❌ .env.staging not found!"
      echo "Create it from .env.staging.example:"
      echo "  cp .env.staging.example .env.staging"
      echo "  # Then add your staging keys"
      exit 1
    fi
    cp .env.staging .env
    echo "✅ Switched to STAGING environment"
    echo "   URL: https://tmuazbkketrrnmtkzfjd.supabase.co"
    echo ""
    echo "Run: npm run dev"
    ;;
  production|prod)
    if [ ! -f .env.production ]; then
      echo "❌ .env.production not found!"
      echo "Create it from .env.production.example:"
      echo "  cp .env.production.example .env.production"
      exit 1
    fi
    cp .env.production .env
    echo "✅ Switched to PRODUCTION environment"
    echo "   URL: https://buntxbgjixlksffbscle.supabase.co"
    echo ""
    echo "⚠️  WARNING: You are now using PRODUCTION database!"
    echo "Run: npm run dev"
    ;;
  *)
    echo "❌ Invalid environment: $ENV"
    echo "Usage: ./switch-env.sh [staging|production]"
    exit 1
    ;;
esac

