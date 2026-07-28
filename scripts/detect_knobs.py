#!/usr/bin/env python3
"""Detección genérica de perillas en fotos de un pedal de efectos.

No identifica marca ni modelo de pedal: solo ubica círculos (perillas) y
estima hacia qué hora del reloj apunta la marca de cada una (1-12), igual
que se describe una perilla en la jerga de músicos ("está a las 3"). No
requiere saber dónde está el 0% ni el 100% de cada perilla — cada una puede
empezar y terminar en un punto distinto de la circunferencia según el
modelo, y el reloj no depende de eso.

Recibe VARIAS fotos de la misma escena y vota entre ellas: una sola foto no
alcanza para una lectura confiable (ver DECISIONS.md, entrada de votación).
Cuando las fotos no se ponen de acuerdo sobre una perilla, se devuelve esa
perilla con value=null en vez de inventar un número — para un usuario que no
ve, una respuesta incorrecta dicha con seguridad es peor que "no pude leerla".

Uso: python3 detect_knobs.py <img1> [img2 ...]
Salida (stdout, JSON):
  Éxito: {"knobs": [{"label": "Arriba izquierda", "value": 3, "agreement": 4}, ...],
          "framesCaptured": 5, "framesUsed": 4}
         value es null si no hubo acuerdo suficiente; agreement es sobre framesUsed.
  Error: {"error": "..."}  (exit code 1)
"""
import sys
import json
import math
import statistics
from collections import Counter, defaultdict

import cv2
import numpy as np

# Ancho de trabajo: así los parámetros de Hough no dependen de la resolución
# de la foto original (un celular puede entregar 800px o 4000px). Se intenta
# primero a WORK_WIDTH_BASE; si se detectan pocas perillas (foto tomada más
# lejos del pedal, perillas chicas en píxeles), se reintenta agrandando la
# imagen de trabajo — más barato y menos ruidoso que bajar el radio mínimo
# de Hough, que dejaba pasar círculos chicos espurios (ej. el selector LED
# del pedal) en fotos de cerca. Ver DECISIONS.md.
WORK_WIDTH_BASE = 1000
WORK_WIDTH_FALLBACK = 1800
MIN_KNOBS_BEFORE_FALLBACK = 3

# Parámetros de cv2.HoughCircles (variante GRADIENT_ALT, más robusta a ruido
# de fondo que la variante clásica). Calibrados sobre WORK_WIDTH=1000 contra
# fotos reales de un pedal (ver DECISIONS.md, entrada de calibración).
HOUGH_DP = 1.5
HOUGH_MIN_DIST = 80
HOUGH_PARAM1 = 300
HOUGH_PARAM2 = 0.55
HOUGH_MIN_RADIUS = 40
HOUGH_MAX_RADIUS = 120

# Distancia (relativa al radio, con piso absoluto) por debajo de la cual dos
# detecciones de distintas pasadas de Hough se consideran la misma perilla
# física. El piso absoluto es necesario porque el radio que entrega Hough
# para perillas glossy/oscuras es poco confiable (varía 2x+ entre fotos de
# la misma perilla física).
#
# El piso estaba en 150 px, MÁS del doble de HOUGH_MIN_DIST: en una grilla 2x2
# con perillas de ~60 px de radio, dos perillas vecinas caen dentro de esos
# 150 px y se fusionaban en una sola. Medido sobre 92 fotos reales, bajarlo a
# 110 px sube las detecciones correctas de 4 perillas del 46% al 58%.
MERGE_DIST_RATIO = 0.5
MERGE_DIST_MIN_PX = 110

# Brillo medio máximo para considerar un círculo como perilla. Las perillas
# de pedal son casi siempre de plástico negro/oscuro; partes metálicas
# reflectantes (footswitch, jacks) y fondo (madera, cuerpo del pedal) dan
# un brillo medio mucho más alto y se descartan con este umbral.
KNOB_MAX_MEAN = 70

# Distancia espacial máxima (relativa a la mediana de distancias al centro
# del grupo) para que una detección se considere parte del conjunto de
# perillas. Las perillas reales están agrupadas en el panel del pedal;
# un círculo aislado lejos del grupo es ruido del fondo.
OUTLIER_DIST_RATIO = 2.5
OUTLIER_MIN_DIST_PX = 150

# Banda donde se busca la marca indicadora, RELATIVA al radio detectado.
#
# Antes era una banda absoluta de 30-115 px. Medido sobre 92 fotos reales, el
# radio de las perillas detectadas va de 45 a 110 px (mediana 63): la banda fija
# excedía el radio de la propia perilla en las 280 detecciones, o sea que el
# algoritmo SIEMPRE terminaba mirando el panel del pedal, la serigrafía blanca
# ("SUB", "SUB 2") y hasta la mesa de madera del fondo, que son más brillantes
# que la marca. Las horas que reportaba eran, en los hechos, la dirección de lo
# más brillante alrededor de la perilla.
#
# La marca vive cerca del BORDE de la cara superior (~0.6-1.1 del radio
# detectado), no en el centro: la perilla se ve en perspectiva y su cara
# superior queda desplazada respecto de la silueta.
POINTER_INNER_FRAC = 0.60
POINTER_OUTER_FRAC = 1.15
POINTER_ANGLE_STEP_DEG = 2

# Separación angular contra la que se compara cada rayo para puntuarlo.
# La marca es una LÍNEA fina: brilla mucho más que sus vecinos angulares.
# Un reflejo especular sobre el plástico glossy es ancho, así que brilla
# parecido a sus vecinos y se cancela. Puntuar por brillo absoluto (como
# antes) no distingue una cosa de la otra; puntuar por contraste lateral sí.
POINTER_LATERAL_DELTA_DEG = 20

# Contraste lateral mínimo para aceptar que hay una marca. Medido sobre las
# 313 detecciones de las fotos reales: el percentil 1 está en 29 y la mediana
# en 122, así que 30 descarta solo los círculos sin marca visible sin recortar
# lecturas buenas. No hace falta ser más estricto acá: de la incertidumbre se
# encarga la votación entre fotos.
MIN_POINTER_CONTRAST = 30

# Fracción del radio promedio usada para agrupar perillas en la misma fila
# al ordenarlas (layouts en grilla, ej. 2x2, son comunes en pedales reales).
ROW_GROUP_RATIO = 0.6

# Votación: cuántas de las fotos recibidas tienen que coincidir en la misma
# hora para reportarla. Medido sobre las fotos reales, con 5 fotos y mayoría
# de 3 el sistema responde en el 80% de las perillas y acierta el 93% de las
# veces que responde; con una sola foto acierta el 68% y nunca se abstiene.
MIN_AGREEMENT = 3

# Nombres de posición en la grilla. Se prefiere una etiqueta espacial
# ("Arriba izquierda") sobre un índice ("Perilla 2") porque el índice no es
# una identidad estable: si una foto detecta 3 perillas y la siguiente 4,
# "Perilla 2" pasa a referirse a otra perilla física y el usuario que no ve
# no tiene forma de notarlo. La posición en el panel sí es estable.
ROW_NAMES = {1: [''], 2: ['Arriba', 'Abajo']}
COL_NAMES = {
    1: [''],
    2: ['izquierda', 'derecha'],
    3: ['izquierda', 'centro', 'derecha'],
}


def fail(message: str) -> None:
    print(json.dumps({"error": message}))
    sys.exit(1)


def detect_circles_pass(gray: np.ndarray) -> list[tuple[int, int, int]]:
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT_ALT,
        dp=HOUGH_DP,
        minDist=HOUGH_MIN_DIST,
        param1=HOUGH_PARAM1,
        param2=HOUGH_PARAM2,
        minRadius=HOUGH_MIN_RADIUS,
        maxRadius=HOUGH_MAX_RADIUS,
    )
    if circles is None:
        return []
    return [(int(x), int(y), int(r)) for x, y, r in np.round(circles[0]).astype(int)]


def merge_candidates(candidates: list[tuple[int, int, int]]) -> list[tuple[int, int, int]]:
    merged: list[tuple[int, int, int]] = []
    for x, y, r in candidates:
        if any(
            math.hypot(x - mx, y - my) < max(MERGE_DIST_RATIO * max(r, mr), MERGE_DIST_MIN_PX)
            for mx, my, mr in merged
        ):
            continue
        merged.append((x, y, r))
    return merged


def circular_mask_mean(gray: np.ndarray, cx: int, cy: int, r: int) -> float:
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.circle(mask, (cx, cy), r, 255, -1)
    return float(cv2.mean(gray, mask=mask)[0])


def ray_mean(gray: np.ndarray, cx: int, cy: int, r: int, angle_deg: float) -> float:
    """Brillo promedio a lo largo de un rayo, dentro de la banda de la marca."""
    height, width = gray.shape
    cos_a, sin_a = math.cos(math.radians(angle_deg)), math.sin(math.radians(angle_deg))
    samples = []
    for rr in range(int(POINTER_INNER_FRAC * r), int(POINTER_OUTER_FRAC * r)):
        x, y = int(cx + rr * cos_a), int(cy + rr * sin_a)
        if 0 <= y < height and 0 <= x < width:
            samples.append(float(gray[y, x]))
    return float(np.mean(samples)) if samples else 0.0


def detect_pointer_angle(gray: np.ndarray, cx: int, cy: int, r: int):
    """Devuelve (ángulo, contraste) del rayo que mejor se comporta como línea.

    El puntaje de cada rayo es su brillo menos el de sus vecinos angulares:
    premia estructuras finas (la marca) y castiga manchas anchas (los reflejos
    del plástico brillante), que antes ganaban por brillo absoluto.
    """
    profile = {
        angle: ray_mean(gray, cx, cy, r, angle)
        for angle in range(0, 360, POINTER_ANGLE_STEP_DEG)
    }

    best_angle, best_score = None, -1e9
    for angle, value in profile.items():
        left = profile[(angle - POINTER_LATERAL_DELTA_DEG) % 360]
        right = profile[(angle + POINTER_LATERAL_DELTA_DEG) % 360]
        score = value - 0.5 * (left + right)
        if score > best_score:
            best_angle, best_score = angle, score

    return best_angle, best_score


def angle_to_clock_hour(angle_deg: float) -> int:
    """Convierte el ángulo medido (0°=derecha, sentido horario) a hora de reloj 1-12.

    12 en punto = arriba de la imagen. No depende de saber dónde está el
    "mínimo" o "máximo" de la perilla — es una lectura directa de hacia
    dónde apunta la marca, igual que la jerga de músicos ("a las 3").
    """
    raw_hour = ((angle_deg - 270) / 30) % 12
    hour = round(raw_hour) % 12
    return 12 if hour == 0 else hour


def drop_spatial_outliers(detected: list[dict]) -> list[dict]:
    if len(detected) <= 2:
        return detected
    xs = sorted(k["cx"] for k in detected)
    ys = sorted(k["cy"] for k in detected)
    med_x, med_y = xs[len(xs) // 2], ys[len(ys) // 2]
    dists = [math.hypot(k["cx"] - med_x, k["cy"] - med_y) for k in detected]
    med_dist = sorted(dists)[len(dists) // 2] or 1
    threshold = max(med_dist * OUTLIER_DIST_RATIO, OUTLIER_MIN_DIST_PX)
    return [k for k, d in zip(detected, dists) if d <= threshold]


def group_rows(knobs: list[dict]) -> list[list[dict]]:
    """Agrupa perillas en filas (arriba->abajo), cada una ordenada izq->der.

    Layouts en grilla (ej. 2x2) son comunes en pedales reales; ordenar solo
    por x mezclaría columnas de filas distintas de forma impredecible.
    """
    if not knobs:
        return []
    avg_r = sum(k["r"] for k in knobs) / len(knobs)
    row_threshold = avg_r * ROW_GROUP_RATIO

    rows: list[list[dict]] = []
    for k in sorted(knobs, key=lambda k: k["cy"]):
        row = next((r for r in rows if abs(k["cy"] - r[0]["cy"]) < row_threshold), None)
        if row is not None:
            row.append(k)
        else:
            rows.append([k])

    for row in rows:
        row.sort(key=lambda k: k["cx"])
    return rows


def position_labels(rows: list[list[dict]]) -> list[str]:
    """Etiqueta cada perilla por su lugar en el panel, en orden de lectura."""
    row_words = ROW_NAMES.get(len(rows))
    labels: list[str] = []
    index = 0

    for row_i, row in enumerate(rows):
        col_words = COL_NAMES.get(len(row))
        for col_i in range(len(row)):
            index += 1
            if row_words is None or col_words is None:
                # Layout fuera de los casos cubiertos (ej. 3 filas, 4 columnas):
                # se cae al índice, menos útil pero nunca ambiguo dentro de una
                # misma respuesta.
                labels.append(f"Perilla {index}")
                continue
            text = f"{row_words[row_i]} {col_words[col_i]}".strip()
            labels.append(text[:1].upper() + text[1:] if text else f"Perilla {index}")

    return labels


def detect_frame_at_width(img: np.ndarray, work_width: int) -> list[dict]:
    scale = work_width / img.shape[1]
    img = cv2.resize(img, (work_width, int(img.shape[0] * scale)))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.medianBlur(gray, 5)

    # Tres variantes de contraste: ninguna sola detecta de forma confiable las
    # 4 perillas en fotos reales con luz despareja/reflejos — la unión de las
    # tres sí. equalizeHist/CLAHE recuperan contraste en zonas con glare que
    # la imagen sin ecualizar pierde, a costa de perder otras zonas que sí
    # detecta la imagen sin ecualizar.
    gray_eq = cv2.equalizeHist(gray_blur)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray_clahe = clahe.apply(gray_blur)

    all_candidates = (
        detect_circles_pass(gray_blur)
        + detect_circles_pass(gray_eq)
        + detect_circles_pass(gray_clahe)
    )

    detected = []
    for x, y, r in merge_candidates(all_candidates):
        if circular_mask_mean(gray, x, y, r) >= KNOB_MAX_MEAN:
            continue  # parte metálica/reflectante o fondo, no una perilla
        angle, score = detect_pointer_angle(gray, x, y, r)
        if angle is None or score < MIN_POINTER_CONTRAST:
            continue  # sin marca clara: se descarta en vez de inventar un valor
        detected.append({"cx": x, "cy": y, "r": r, "value": angle_to_clock_hour(angle)})

    return drop_spatial_outliers(detected)


def detect_frame(img: np.ndarray) -> list[list[dict]]:
    """Detecta las perillas de UNA foto y las devuelve agrupadas por filas."""
    detected = detect_frame_at_width(img, WORK_WIDTH_BASE)
    if len(detected) < MIN_KNOBS_BEFORE_FALLBACK:
        fallback = detect_frame_at_width(img, WORK_WIDTH_FALLBACK)
        if len(fallback) > len(detected):
            detected = fallback
    return group_rows(detected)


def vote(frames: list[list[list[dict]]]) -> list[dict]:
    """Vota la hora de cada perilla entre las fotos que coinciden en el layout.

    Solo se votan las fotos cuyo layout coincide con el más frecuente: si una
    foto detectó 3 perillas y otra 4, sus posiciones no son comparables entre
    sí y mezclarlas produciría exactamente el corrimiento de identidad que la
    votación intenta evitar.
    """
    layouts = Counter(tuple(len(row) for row in f) for f in frames if f)
    if not layouts:
        return [], 0
    layout, _ = layouts.most_common(1)[0]

    usable = [f for f in frames if tuple(len(row) for row in f) == layout]
    labels = position_labels(usable[0])

    by_position: dict[int, list[int]] = defaultdict(list)
    for frame in usable:
        flat = [k for row in frame for k in row]
        for i, knob in enumerate(flat):
            by_position[i].append(knob["value"])

    knobs = []
    for i, label in enumerate(labels):
        values = by_position.get(i, [])
        if values:
            value, agreement = Counter(values).most_common(1)[0]
        else:
            value, agreement = None, 0
        knobs.append(
            {
                "label": label,
                # Sin acuerdo suficiente se devuelve null: la UI lo comunica como
                # "no pude leerla con confianza" en vez de arriesgar un número.
                "value": value if agreement >= MIN_AGREEMENT else None,
                "agreement": agreement,
            }
        )
    return knobs, len(usable)


def main() -> None:
    if len(sys.argv) < 2:
        fail("Faltan las rutas de las imágenes")

    frames = []
    for path in sys.argv[1:]:
        img = cv2.imread(path)
        if img is None:
            continue
        frames.append(detect_frame(img))

    if not frames:
        fail("No se pudo leer ninguna de las imágenes")

    knobs, frames_used = vote(frames)
    if not knobs:
        fail(
            "No se detectaron perillas en la imagen. "
            "Verificá el encuadre, la distancia y la iluminación."
        )

    print(
        json.dumps(
            {"knobs": knobs, "framesCaptured": len(frames), "framesUsed": frames_used}
        )
    )
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001 - nunca debe escapar un traceback crudo a stdout
        fail(f"Error inesperado al procesar la imagen: {e}")
