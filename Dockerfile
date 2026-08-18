# Imagen base: Debian Bookworm slim con Node 20 LTS.
# Se mantiene Debian y no Alpine por compatibilidad de los paquetes de sistema
# (tesseract, poppler) y para no cambiar una base ya validada. La razón original
# —los wheels manylinux de opencv-python-headless— dejó de aplicar cuando
# /pedal pasó a resolverse con un modelo multimodal (ver DECISIONS.md).
FROM node:20-bookworm-slim

# Dependencias de sistema:
#   tesseract-ocr      → OCR del cifrado de acordes en /api/ocr
#   poppler-utils      → pdftoppm, convierte partituras en PDF a imagen
# Ya no se instalan python3, opencv-python-headless ni numpy: el detector de
# perillas por visión clásica (scripts/detect_knobs.py) quedó en el repo como
# evidencia del proceso, pero la app no lo invoca y no necesita correrlo.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

# Variables de entorno esperadas en runtime (nunca hardcodeadas en la imagen):
#   GEMINI_API_KEY  → detección de perillas en /pedal. Sin ella, esa pantalla
#                     responde con un mensaje narrado y el resto sigue andando.
#   GEMINI_MODEL    → opcional, modelo multimodal a usar.
CMD ["npm", "start"]
