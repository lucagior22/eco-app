# Imagen base: Debian Bookworm slim con Node 20 LTS.
# Se descartó Alpine porque oemer depende de onnxruntime-gpu, cuyos wheels
# de PyPI son manylinux (glibc). En Alpine (musl) pip no puede instalarlos
# y la alternativa (py3-onnxruntime del repo Alpine) no incluye la variante -gpu.
# Debian tiene glibc → los wheels manylinux instalan sin problema.
FROM node:20-bookworm-slim

# Librerías de sistema que necesitan las dependencias de Python de oemer:
#   python3 / pip3     → runtime e instalador de oemer
#   libglib2.0-0       → requerida por opencv-python-headless al importar cv2
#   libgomp1           → OpenMP, requerida por scikit-learn / onnxruntime en CPU
# Se instala en un solo RUN para reducir capas y limpiar la caché de apt.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# oemer declara onnxruntime-gpu como dependencia, pero este proyecto corre sin GPU.
# Se instala primero onnxruntime (CPU-only) con --no-deps para que pip no lo
# reemplace luego por la variante -gpu; oemer funciona idéntico con cualquiera
# de los dos paquetes porque onnxruntime-gpu también ejecuta en CPU cuando no
# hay CUDA disponible, y la API es la misma.
# --break-system-packages es necesario en Debian Bookworm porque Python 3.11+
# marca el entorno como "externally managed" por defecto (PEP 668).
RUN pip3 install --no-cache-dir --break-system-packages onnxruntime

# Se instala oemer después de haber fijado onnxruntime (CPU).
# pip detecta que onnxruntime ya está instalado y satisface la dependencia
# sin instalar la variante -gpu (que requeriría CUDA en runtime).
RUN pip3 install --no-cache-dir --break-system-packages oemer

# Nota: oemer descarga los checkpoints de los modelos la primera vez que
# se invoca. Esto ocurrirá en el primer request al endpoint /api/ocr y puede
# tomar varios minutos. Si se quiere pre-descargar durante el build, se puede
# agregar: RUN python3 -c "import oemer"
# No se hace aquí porque alarga el build y aumenta el tamaño de la imagen sin
# beneficio claro en desarrollo. Documentado en DECISIONS.md.

# opencv-python-headless y numpy: usados por scripts/detect_knobs.py (detección
# de perillas de pedal, ver /api/pedal/detect). Ya llegan transitivamente como
# dependencias de oemer, pero se declaran explícitas para no depender de una
# dependencia transitiva de un paquete de terceros: si una futura versión de
# oemer deja de necesitarlas, el build de detect_knobs.py se rompería sin que
# el cambio sea visible en este Dockerfile.
RUN pip3 install --no-cache-dir --break-system-packages opencv-python-headless numpy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
