# ── Stage 1: Install dependencies ───────────────────────────────
FROM node:18-slim AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Skip Puppeteer's bundled Chromium — we use system Chromium in stage 2
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm ci --omit=dev

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM node:18-slim

# System dependencies:
#   chromium          – headless browser for Puppeteer
#   poppler-utils     – pdftoppm for PDF→image conversion (OCR pipeline)
#   tesseract-ocr     – OCR engine (English)
#   tesseract-ocr-fra – OCR French language pack
#   fonts-liberation  – standard fonts so Chromium renders pages correctly
#   ca-certificates   – HTTPS requests
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-fra \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create writable directories
RUN mkdir -p output credentials output/.file-store \
  && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

CMD ["npm", "start"]
