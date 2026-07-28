# Imagen base: Debian Bookworm slim con Node 20 LTS.
# Se descarta Alpine porque opencv-python-headless (detección de perillas en
# /pedal) se distribuye en PyPI como wheels manylinux (glibc). En Alpine (musl)
# pip no puede instalarlos y tendría que compilar OpenCV desde fuente.
# Debian tiene glibc → los wheels manylinux instalan sin problema.
FROM node:20-bookworm-slim

# Dependencias de sistema:
#   python3 / pip3     → runtime e instalador de scripts/detect_knobs.py
#   tesseract-ocr      → OCR del cifrado de acordes en /api/ocr
#   poppler-utils      → pdftoppm, convierte partituras en PDF a imagen
#   libglib2.0-0       → requerida por opencv-python-headless al importar cv2
#   libgomp1           → OpenMP, requerida por OpenCV en CPU
# Se instala en un solo RUN para reducir capas y limpiar la caché de apt.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    tesseract-ocr \
    poppler-utils \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# opencv-python-headless y numpy: usados por scripts/detect_knobs.py (detección
# de perillas de pedal, ver /api/pedal/detect). Antes llegaban transitivamente
# como dependencias de oemer; al removerse oemer, esta línea es la única que
# las instala — de ahí que ya estuvieran declaradas explícitas.
# --break-system-packages es necesario en Debian Bookworm porque Python 3.11+
# marca el entorno como "externally managed" por defecto (PEP 668).
RUN pip3 install --no-cache-dir --break-system-packages opencv-python-headless numpy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
