# =============================================================================
# Multi-stage Dockerfile for QAQC4BI (Next.js 16 + better-sqlite3)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-slim AS deps

WORKDIR /app

# Install build tools required by better-sqlite3 (native C++ addon)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: Build the Next.js application
# ---------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production image — keep it slim
# ---------------------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# better-sqlite3 needs a few shared libraries at runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 --ingroup appgroup appuser

# Copy the build output and required files
COPY --from=builder /app/public              ./public
COPY --from=builder /app/.next               ./.next
COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/package.json        ./package.json
COPY --from=builder /app/next.config.ts      ./next.config.ts

# Create the data directory for SQLite and set ownership
RUN mkdir -p /app/data && chown -R appuser:appgroup /app /app/data

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["npm", "start"]
