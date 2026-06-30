#!/usr/bin/env python3
"""Detección genérica de perillas en una foto de pedal de efectos.

No identifica marca ni modelo de pedal: solo ubica círculos (perillas) y
estima hacia qué hora del reloj apunta la marca de cada una (1-12), igual
que se describe una perilla en la jerga de músicos ("está a las 3"). No
requiere saber dónde está el 0% ni el 100% de cada perilla — cada una puede
empezar y terminar en un punto distinto de la circunferencia según el
modelo de pedal, y el reloj no depende de eso.

Uso: python3 detect_knobs.py <ruta_imagen>
Salida (stdout, JSON):
  Éxito: {"knobs": [{"label": "Perilla 1", "value": 3}, ...]}  (value = hora 1-12)
  Error: {"error": "..."}  (exit code 1)
"""
import sys
import json
import math
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
# la misma perilla física), así que un umbral puramente relativo a r a veces
# no alcanza para fusionar dos detecciones de la misma perilla.
MERGE_DIST_RATIO = 0.5
MERGE_DIST_MIN_PX = 150

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

# Banda ABSOLUTA (en píxeles, sobre WORK_WIDTH=1000) donde se busca la marca
# indicadora, en vez de una fracción del radio detectado por Hough — ese radio
# no es confiable (ver MERGE_DIST_MIN_PX), así que atarse a él hace que la
# búsqueda mire el anillo equivocado del knob. La ventana desliza dentro de
# esta banda en ángulo y en radio; el promedio sobre la ventana evita que
# ruido de un solo píxel domine la decisión.
POINTER_INNER_R_PX = 30
POINTER_OUTER_R_PX = 115
POINTER_WINDOW_PX = 18
POINTER_ANGLE_STEP_DEG = 2
MIN_POINTER_CONTRAST = 15

# Fracción del radio promedio usada para agrupar perillas en la misma fila
# al ordenarlas (layouts en grilla, ej. 2x2, son comunes en pedales reales).
ROW_GROUP_RATIO = 0.6


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


def detect_pointer_angle(gray: np.ndarray, cx: int, cy: int, knob_mean: float):
    # Busca, en ángulo y en radio (dentro de la banda absoluta), la ventana
    # con mayor brillo PROMEDIO por sobre el brillo medio del knob.
    #
    # Solo se buscan excursiones hacia el brillo (no abs(diff)): la marca
    # indicadora es siempre blanca/clara. Estas perillas tienen una sombra
    # oscura donde la base cilíndrica se junta con el panel del pedal, que
    # también es "alto contraste" respecto al promedio — con abs(diff) el
    # algoritmo a veces enganchaba esa sombra en vez de la marca real,
    # dando lecturas opuestas (~180°) de forma intermitente entre fotos
    # de la MISMA perilla física sin tocar. Ver DECISIONS.md.
    height, width = gray.shape
    best_angle, best_score = None, -1e9

    for angle_deg in range(0, 360, POINTER_ANGLE_STEP_DEG):
        rad = math.radians(angle_deg)
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        for win_start in range(POINTER_INNER_R_PX, POINTER_OUTER_R_PX - POINTER_WINDOW_PX, 6):
            samples = []
            for rr in range(win_start, win_start + POINTER_WINDOW_PX, 3):
                x = int(cx + rr * cos_a)
                y = int(cy + rr * sin_a)
                if 0 <= y < height and 0 <= x < width:
                    samples.append(gray[y, x])
            if not samples:
                continue
            score = float(np.mean(samples)) - knob_mean
            if score > best_score:
                best_score, best_angle = score, angle_deg

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


def order_grid(knobs: list[dict]) -> list[dict]:
    """Ordena perillas por fila (arriba->abajo) y, dentro de cada fila, izquierda->derecha.

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

    ordered: list[dict] = []
    for row in rows:
        row.sort(key=lambda k: k["cx"])
        ordered.extend(row)
    return ordered


def detect_knobs_at_width(img: np.ndarray, work_width: int) -> list[dict]:
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
    circles = merge_candidates(all_candidates)

    detected = []
    for x, y, r in circles:
        knob_mean = circular_mask_mean(gray, x, y, r)
        if knob_mean >= KNOB_MAX_MEAN:
            continue  # parte metálica/reflectante o fondo, no una perilla
        angle, score = detect_pointer_angle(gray, x, y, knob_mean)
        if angle is None or score < MIN_POINTER_CONTRAST:
            continue  # sin marca clara: se descarta en vez de inventar un valor
        detected.append({"cx": x, "cy": y, "r": r, "value": angle_to_clock_hour(angle)})

    detected = drop_spatial_outliers(detected)
    return order_grid(detected)


def main() -> None:
    if len(sys.argv) < 2:
        fail("Falta el argumento de ruta de imagen")

    image_path = sys.argv[1]
    img = cv2.imread(image_path)
    if img is None:
        fail("No se pudo leer la imagen")

    ordered = detect_knobs_at_width(img, WORK_WIDTH_BASE)
    if len(ordered) < MIN_KNOBS_BEFORE_FALLBACK:
        ordered_fallback = detect_knobs_at_width(img, WORK_WIDTH_FALLBACK)
        if len(ordered_fallback) > len(ordered):
            ordered = ordered_fallback

    if not ordered:
        fail("No se detectaron perillas en la imagen. Verificá el encuadre, la distancia y la iluminación.")

    knobs = [{"label": f"Perilla {i + 1}", "value": k["value"]} for i, k in enumerate(ordered)]

    print(json.dumps({"knobs": knobs}))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001 - nunca debe escapar un traceback crudo a stdout
        fail(f"Error inesperado al procesar la imagen: {e}")
