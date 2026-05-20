"""
WESEKA.IA · Roadmap META Ads · Inmobiliaria Bochile
Genera el PDF de estrategia para reunión 16:00.
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY

# ---------- COLORES WESEKA.IA ----------
NAVY = HexColor('#0A1629')
NAVY2 = HexColor('#0D1B2F')
NAVY3 = HexColor('#0C1A2B')
NAVY4 = HexColor('#0E1D31')
GOLD = HexColor('#B8894A')
GOLD_BRIGHT = HexColor('#D4A85E')
GOLD_SOFT = HexColor('#1B1410')
CREAM = HexColor('#F5EDD8')
CREAM2 = HexColor('#E8E2D0')
GRAY = HexColor('#B8B2A3')
GRAY2 = HexColor('#8A8470')
GREEN = HexColor('#6BAA75')
RED = HexColor('#C97064')
BLUE = HexColor('#7AA5C4')

# Borde sutil dorado
def gold_alpha(a):
    return Color(184/255, 137/255, 74/255, alpha=a)

# ---------- CONFIGURACIÓN ----------
PAGE_W, PAGE_H = A4
MARGIN = 42
CONTENT_W = PAGE_W - 2*MARGIN

OUTPUT_PATH = "/sessions/zen-brave-babbage/mnt/outputs/Bochile-Roadmap-META.pdf"

# ---------- HELPERS DE DIBUJO ----------

def page_chrome(c, page_num, total):
    """Background y elementos persistentes de cada página"""
    # Fondo navy
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Header bar
    c.setFillColor(NAVY2)
    c.rect(0, PAGE_H - 32, PAGE_W, 32, fill=1, stroke=0)

    # Línea sutil dorada bajo header
    c.setStrokeColor(gold_alpha(0.25))
    c.setLineWidth(0.5)
    c.line(MARGIN, PAGE_H - 32, PAGE_W - MARGIN, PAGE_H - 32)

    # Brand izquierda
    c.setFont('Helvetica-Bold', 7.5)
    c.setFillColor(CREAM)
    # punto dorado
    c.setFillColor(GOLD)
    c.circle(MARGIN + 3, PAGE_H - 17, 2, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.drawString(MARGIN + 10, PAGE_H - 19, "WESEKA · IA")
    c.setFillColor(GOLD)
    c.drawString(MARGIN + 56, PAGE_H - 19, "·")
    c.setFillColor(GRAY2)
    c.drawString(MARGIN + 62, PAGE_H - 19, "ROADMAP META")

    # Page number derecha
    c.setFont('Helvetica', 7.5)
    c.setFillColor(GRAY2)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 19, f"Inmobiliaria Bochile  ·  {page_num:02d} / {total:02d}")

    # Footer
    c.setStrokeColor(gold_alpha(0.15))
    c.setLineWidth(0.5)
    c.line(MARGIN, 30, PAGE_W - MARGIN, 30)
    c.setFont('Helvetica', 6.5)
    c.setFillColor(GRAY2)
    c.drawString(MARGIN, 18, "CONFIDENCIAL  ·  Estrategia de adquisición META Ads para Inmobiliaria Bochile")
    c.drawRightString(PAGE_W - MARGIN, 18, "Bahía Blanca  ·  2026")


def section_header(c, eyebrow, title, y, italic_words=None):
    """Cabezal de sección con eyebrow y título serif"""
    # Eyebrow
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN, y, eyebrow.upper())

    # Línea
    c.setStrokeColor(gold_alpha(0.4))
    c.setLineWidth(0.6)
    c.line(MARGIN, y - 4, MARGIN + 30, y - 4)

    # Título
    c.setFont('Times-Roman', 24)
    c.setFillColor(CREAM)
    if italic_words:
        # Manejar italicized portion
        words = title.split('//')
        if len(words) == 2:
            c.drawString(MARGIN, y - 30, words[0].strip())
            c.setFont('Times-Italic', 24)
            c.setFillColor(GOLD_BRIGHT)
            w_first = c.stringWidth(words[0].strip(), 'Times-Roman', 24)
            c.drawString(MARGIN + w_first + 6, y - 30, words[1].strip())
            return y - 30
    c.drawString(MARGIN, y - 30, title)
    return y - 30


def draw_text_block(c, text, x, y, max_width, font='Helvetica', size=9.5, color=GRAY, leading=None):
    """Texto de párrafo con wrapping"""
    if leading is None:
        leading = size * 1.5
    c.setFont(font, size)
    c.setFillColor(color)

    words = text.split()
    line = ""
    cur_y = y
    for w in words:
        test = (line + " " + w).strip()
        if c.stringWidth(test, font, size) > max_width:
            c.drawString(x, cur_y, line)
            cur_y -= leading
            line = w
        else:
            line = test
    if line:
        c.drawString(x, cur_y, line)
        cur_y -= leading
    return cur_y


def card(c, x, y, w, h, fill=NAVY2, stroke_alpha=0.18):
    """Caja base WESEKA"""
    c.setFillColor(fill)
    c.setStrokeColor(gold_alpha(stroke_alpha))
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, 6, fill=1, stroke=1)


def gold_rule(c, x, y, w, alpha=0.3):
    """Línea horizontal sutil dorada"""
    c.setStrokeColor(gold_alpha(alpha))
    c.setLineWidth(0.5)
    c.line(x, y, x + w, y)


def label_pill(c, x, y, text, color=GOLD_BRIGHT, bg=None):
    """Pill / label con fondo sutil"""
    c.setFont('Helvetica-Bold', 7)
    w = c.stringWidth(text, 'Helvetica-Bold', 7) + 14
    h = 14
    if bg:
        c.setFillColor(bg)
        c.setStrokeColor(gold_alpha(0.4))
        c.setLineWidth(0.5)
        c.roundRect(x, y - 3, w, h, 3, fill=1, stroke=1)
    c.setFillColor(color)
    c.drawString(x + 7, y, text)
    return w


# ============================================================
# PÁGINAS
# ============================================================

def cover_page(c, total_pages):
    """Página 1: Portada"""
    # Background custom
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Grid sutil
    c.setStrokeColor(gold_alpha(0.04))
    c.setLineWidth(0.3)
    for i in range(0, int(PAGE_W), 40):
        c.line(i, 0, i, PAGE_H)
    for j in range(0, int(PAGE_H), 40):
        c.line(0, j, PAGE_W, j)

    # Marca esquinas (corners)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    cl = 22
    # top-left
    c.line(MARGIN, PAGE_H - MARGIN, MARGIN + cl, PAGE_H - MARGIN)
    c.line(MARGIN, PAGE_H - MARGIN, MARGIN, PAGE_H - MARGIN - cl)
    # top-right
    c.line(PAGE_W - MARGIN - cl, PAGE_H - MARGIN, PAGE_W - MARGIN, PAGE_H - MARGIN)
    c.line(PAGE_W - MARGIN, PAGE_H - MARGIN, PAGE_W - MARGIN, PAGE_H - MARGIN - cl)
    # bottom-left
    c.line(MARGIN, MARGIN, MARGIN + cl, MARGIN)
    c.line(MARGIN, MARGIN, MARGIN, MARGIN + cl)
    # bottom-right
    c.line(PAGE_W - MARGIN - cl, MARGIN, PAGE_W - MARGIN, MARGIN)
    c.line(PAGE_W - MARGIN, MARGIN, PAGE_W - MARGIN, MARGIN + cl)

    # Brand block
    c.setFillColor(GOLD)
    c.circle(PAGE_W/2 - 36, PAGE_H - 130, 3, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 9)
    c.setFillColor(CREAM)
    txt = "WESEKA · IA"
    tw = c.stringWidth(txt, 'Helvetica-Bold', 9)
    c.drawString(PAGE_W/2 - 28, PAGE_H - 132, txt)

    # Eyebrow
    c.setFont('Helvetica-Bold', 9)
    c.setFillColor(GOLD)
    txt = "ROADMAP DE ADQUISICIÓN  ·  META ADS"
    tw = c.stringWidth(txt, 'Helvetica-Bold', 9)
    c.drawCentredString(PAGE_W/2, PAGE_H - 200, txt)

    # Línea
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(PAGE_W/2 - 60, PAGE_H - 215, PAGE_W/2 + 60, PAGE_H - 215)

    # Título principal
    c.setFont('Times-Roman', 32)
    c.setFillColor(CREAM)
    c.drawCentredString(PAGE_W/2, PAGE_H - 270, "Mil conversaciones,")
    c.setFont('Times-Italic', 32)
    c.setFillColor(GOLD_BRIGHT)
    c.drawCentredString(PAGE_W/2, PAGE_H - 305, "no mil clicks.")

    # Subtítulo
    c.setFont('Helvetica', 11)
    c.setFillColor(GRAY)
    c.drawCentredString(PAGE_W/2, PAGE_H - 350, "El plan de 90 días para que Inmobiliaria Bochile")
    c.drawCentredString(PAGE_W/2, PAGE_H - 365, "domine WhatsApp en Bahía Blanca con META Ads.")

    # Box inferior con metas
    box_y = 130
    box_w = 380
    box_x = (PAGE_W - box_w) / 2
    box_h = 110

    c.setFillColor(NAVY3)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.roundRect(box_x, box_y, box_w, box_h, 6, fill=1, stroke=1)

    c.setFont('Helvetica-Bold', 7.5)
    c.setFillColor(GOLD)
    c.drawCentredString(PAGE_W/2, box_y + box_h - 18, "OBJETIVO PROYECTADO  ·  90 DÍAS")

    # 4 KPIs
    kpis = [
        ("250-350", "conversaciones / mes"),
        ("< $0.15", "CPC objetivo"),
        ("280k", "audiencia BB alcanzable"),
        ("4.5x", "ROAS esperado mes 3")
    ]
    col_w = box_w / 4
    for i, (val, lbl) in enumerate(kpis):
        cx = box_x + col_w * i + col_w/2
        c.setFont('Times-Roman', 16)
        c.setFillColor(GOLD_BRIGHT)
        c.drawCentredString(cx, box_y + 50, val)
        c.setFont('Helvetica', 6.5)
        c.setFillColor(GRAY)
        # Soporte multilínea simple
        c.drawCentredString(cx, box_y + 35, lbl)

    # Pie de portada
    c.setFont('Helvetica', 7)
    c.setFillColor(GRAY2)
    c.drawCentredString(PAGE_W/2, 70, "Preparado por WESEKA.IA  ·  Tier inicial USD 350-500 / mes")
    c.drawCentredString(PAGE_W/2, 56, "Documento confidencial  ·  2026")


def page_resumen(c, page_num, total):
    """Página 2: Resumen Ejecutivo"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "01  ·  Resumen ejecutivo", "El plan, // en treinta segundos.", y, italic_words=True)
    y -= 50

    # Intro
    intro = ("Bochile entra a META con una ventaja que ninguna otra inmobiliaria de Bahía Blanca tiene: "
             "una IA vendedora que convierte cada click en una conversación calificada, sin intervención humana. "
             "Por eso el plan no se mide en clicks ni en likes — se mide en cuántas personas terminan hablando con la IA.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=10, leading=15)
    y -= 14

    # 4 cajas: decisiones estratégicas
    box_h = 90
    box_w = (CONTENT_W - 14) / 2

    decisions = [
        ("01", "OBJETIVO ÚNICO: WHATSAPP",
         "Toda la inversión va a la métrica de Mensajes (Click-to-WhatsApp). No web, no formulario. "
         "Cada peso que entra, sale como una conversación viva con la IA Camila."),
        ("02", "AUDIENCIA CHICA, CALIENTE",
         "BB ciudad + 30 km. Tres segmentos definidos. Sin spray-and-pray. "
         "Empezamos con < 280k personas y vamos achicando hasta encontrar el lookalike ganador."),
        ("03", "5 PILARES, 20 ANUNCIOS, ROTACIÓN",
         "Producimos 20 piezas el primer mes (Tour 360°, Educación, Datos, Casos, IA). "
         "Cada 7-10 días rotamos creatividad para evitar fatiga y mantener CPC bajo."),
        ("04", "ESCALAR SOLO CUANDO LOS NÚMEROS MANDAN",
         "Mes 1 valida con $400. Mes 2 sube a $800 si CPC < $0.15. Mes 3+ escala a $2k si "
         "ROAS > 4x. Cero ego, todo dato.")
    ]

    box_y = y - box_h
    for i, (num, title, body) in enumerate(decisions):
        col = i % 2
        row = i // 2
        bx = MARGIN + col * (box_w + 14)
        by = y - row * (box_h + 12) - box_h
        card(c, bx, by, box_w, box_h)

        c.setFont('Times-Italic', 13)
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(bx + 14, by + box_h - 18, num)

        c.setFont('Helvetica-Bold', 9)
        c.setFillColor(CREAM)
        c.drawString(bx + 14, by + box_h - 36, title)

        # Body con wrap
        c.setFont('Helvetica', 8)
        c.setFillColor(GRAY)
        words = body.split()
        line = ""
        cy = by + box_h - 50
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, 'Helvetica', 8) > box_w - 28:
                c.drawString(bx + 14, cy, line)
                cy -= 11
                line = w
            else:
                line = test
        if line:
            c.drawString(bx + 14, cy, line)

    y = box_y - box_h - 12

    # Cierre con quote destacado
    quote_y = 110
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(MARGIN, quote_y + 35, MARGIN, quote_y - 18)

    c.setFont('Times-Italic', 13)
    c.setFillColor(CREAM)
    c.drawString(MARGIN + 16, quote_y + 22, "Bochile no compite con otras inmobiliarias.")
    c.drawString(MARGIN + 16, quote_y + 4, "Compite con la atención de un comprador que está")
    c.drawString(MARGIN + 16, quote_y - 14, "scrolleando Instagram a las 23:00.")


def page_estrategia(c, page_num, total):
    """Página 3: Estrategia central - Click-to-WhatsApp"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "02  ·  Estrategia central", "Por qué WhatsApp // y no otra cosa.", y, italic_words=True)
    y -= 50

    intro = ("El 94% de los argentinos tiene WhatsApp. Es el único canal donde una conversación se siente personal "
             "y un anuncio no se siente como anuncio. Combinado con la IA Camila funcionando 24/7, transforma "
             "cada click en un lead caliente sin que un humano levante el teléfono.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 16

    # PIPELINE VISUAL: 5 etapas horizontales
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN, y, "EL PIPELINE QUE LO HACE FUNCIONAR")
    y -= 18

    stages = [
        ("Anuncio", "Reel / Carousel\nMETA priorizado", GOLD_BRIGHT),
        ("Click", "Va directo a\nWhatsApp", GOLD_BRIGHT),
        ("IA califica", "Camila pregunta\ny entiende", GOLD_BRIGHT),
        ("CRM", "Lead con score\nen pipeline", GOLD_BRIGHT),
        ("Vendedor", "Solo cierra\nlos calientes", GOLD_BRIGHT),
    ]

    n = len(stages)
    gap = 8
    box_w = (CONTENT_W - gap * (n - 1)) / n
    box_h = 80

    for i, (title, body, col) in enumerate(stages):
        bx = MARGIN + i * (box_w + gap)
        card(c, bx, y - box_h, box_w, box_h, fill=NAVY3)

        # Número en esquina
        c.setFont('Times-Italic', 11)
        c.setFillColor(GOLD)
        c.drawString(bx + 8, y - 16, f"0{i+1}")

        # Title
        c.setFont('Helvetica-Bold', 9.5)
        c.setFillColor(CREAM)
        c.drawString(bx + 8, y - 34, title)

        # Body
        c.setFont('Helvetica', 7.5)
        c.setFillColor(GRAY)
        for j, line in enumerate(body.split("\n")):
            c.drawString(bx + 8, y - 50 - j * 11, line)

        # Flecha entre cajas
        if i < n - 1:
            c.setFillColor(GOLD)
            c.setFont('Helvetica-Bold', 14)
            c.drawString(bx + box_w + 1, y - 48, "›")

    y -= box_h + 22

    # COMPARATIVO: Por qué no las otras opciones
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN, y, "POR QUÉ NO OTRAS OPCIONES")
    y -= 16

    options = [
        ("Tráfico al sitio web", "Pierde 60% en redirección. CR < 8%. Bochile no es Mercado Libre."),
        ("Formulario nativo de Meta", "Lead barato pero frío. CR a visita < 4%. Tarda 24h en contactar."),
        ("Llamada telefónica", "Argentinos no atienden números desconocidos. Tasa de respuesta < 12%."),
        ("Click-to-WhatsApp", "El que elegimos. Conversación inmediata, IA atiende, lead calificado en 90s."),
    ]

    for i, (label, body) in enumerate(options):
        is_winner = i == len(options) - 1
        row_h = 28
        ry = y - row_h

        if is_winner:
            c.setFillColor(NAVY2)
            c.setStrokeColor(GOLD)
            c.setLineWidth(1)
            c.roundRect(MARGIN, ry, CONTENT_W, row_h, 4, fill=1, stroke=1)
        else:
            c.setStrokeColor(gold_alpha(0.12))
            c.setLineWidth(0.5)
            c.line(MARGIN, ry, MARGIN + CONTENT_W, ry)

        # Indicador
        c.setFillColor(GREEN if is_winner else RED)
        c.circle(MARGIN + 12, ry + row_h/2, 3, fill=1, stroke=0)

        # Label
        c.setFont('Helvetica-Bold', 9.5)
        c.setFillColor(CREAM if is_winner else GRAY2)
        c.drawString(MARGIN + 24, ry + row_h - 14, label)

        # Body
        c.setFont('Helvetica', 8.5)
        c.setFillColor(GOLD_BRIGHT if is_winner else GRAY)
        c.drawString(MARGIN + 180, ry + row_h - 14, body)

        y = ry

    y -= 14

    # Datos de soporte (mini stat row)
    stats = [
        ("94%", "argentinos\nen WhatsApp"),
        ("$0.04-0.18", "CPC promedio\nMeta a WhatsApp"),
        ("3.2x", "más conversiones\nvs link a web"),
        ("< 90 seg", "tiempo promedio\nde calificación IA"),
    ]
    sw = (CONTENT_W - 12 * 3) / 4
    sh = 56
    for i, (val, lbl) in enumerate(stats):
        sx = MARGIN + i * (sw + 12)
        sy = y - sh
        card(c, sx, sy, sw, sh, fill=NAVY3, stroke_alpha=0.15)

        c.setFont('Times-Roman', 17)
        c.setFillColor(GOLD_BRIGHT)
        c.drawCentredString(sx + sw/2, sy + sh - 26, val)

        c.setFont('Helvetica', 7)
        c.setFillColor(GRAY)
        for j, line in enumerate(lbl.split("\n")):
            c.drawCentredString(sx + sw/2, sy + 16 - j * 10, line)


def page_audiencias(c, page_num, total):
    """Página 4: Las 3 audiencias core"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "03  ·  Audiencias core", "Tres tribus // en Bahía Blanca.", y, italic_words=True)
    y -= 50

    intro = ("La diferencia entre $0.10 y $0.40 de CPC está acá. Audiencia chica + creatividad relevante = "
             "Meta te premia con CPM bajo. Definimos tres segmentos sin solapamiento, cada uno con su propio "
             "lenguaje, su propio dolor y su propio horario.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 14

    audiences = [
        {
            "id": "A1",
            "name": "FAMILIAS COMPRADORAS",
            "age": "28 - 45",
            "size": "~ 78.000 personas",
            "color": GOLD_BRIGHT,
            "desc": "Pareja con 1-2 hijos buscando primera casa propia o upgrade familiar. Dolor: el alquiler ya no rinde, quieren patio para los chicos.",
            "demo": "Pareja · 1-2 hijos · $1.5M-3M ingreso conjunto · Auto propio · Crédito disponible",
            "intereses": "Maternidad/paternidad, decoración, créditos hipotecarios UVA, escuelas BB, mudanzas",
            "geo": "Bahía Blanca capital + Punta Alta + 30 km radio",
            "horario": "Lun-Jue 21-23h · Sáb-Dom 10-13h",
            "ticket": "USD 100-300k",
            "platforms": "IG (60%) · FB (35%) · TikTok (5%)"
        },
        {
            "id": "A2",
            "name": "JÓVENES INQUILINOS",
            "age": "22 - 32",
            "size": "~ 124.000 personas",
            "color": BLUE,
            "desc": "Estudiantes de la UNS, primer trabajo, recién independizándose. Dolor: el mercado de alquiler tradicional es hostil — papeles, garantías, sorpresas.",
            "demo": "Soltero/a o pareja sin hijos · $700k-1.5M ingreso · Estudiante o joven profesional",
            "intereses": "UNS, UPSO, freelance, gaming, cervecerías BB, recitales, gym",
            "geo": "Bahía Blanca capital · zona Centro / Universitario / Villa Mitre",
            "horario": "Mar-Vie 18-22h · todos los días 23-01h",
            "ticket": "$500k - 1M alquiler/mes",
            "platforms": "IG (45%) · TikTok (40%) · FB (15%)"
        },
        {
            "id": "A3",
            "name": "PROPIETARIOS / INVERSORES",
            "age": "35 - 65",
            "size": "~ 76.000 personas",
            "color": GOLD,
            "desc": "Tienen 1-3 propiedades. Quieren rentar mejor o vender sin headaches. Dolor: gestionar inquilinos los está matando o la propiedad está parada.",
            "demo": "Propietario · profesional/empresario · auto premium · viaja eventual",
            "intereses": "Inversiones, real estate, Mercado Libre Inmuebles, Bonos AR, finanzas personales",
            "geo": "Bahía Blanca capital · Palihue / Universitario / Centro",
            "horario": "Lun-Vie 12-14h y 19-22h · Domingo 10-13h",
            "ticket": "USD 50-500k (props que tienen)",
            "platforms": "FB (55%) · IG (35%) · LinkedIn (10%)"
        },
    ]

    box_h = 158
    for i, a in enumerate(audiences):
        by = y - box_h - i * (box_h + 8)
        card(c, MARGIN, by, CONTENT_W, box_h)

        # Header de la audience
        c.setFillColor(a["color"])
        c.rect(MARGIN, by + box_h - 26, 4, 26, fill=1, stroke=0)

        # ID badge
        c.setFont('Times-Italic', 13)
        c.setFillColor(a["color"])
        c.drawString(MARGIN + 14, by + box_h - 18, a["id"])

        # Nombre
        c.setFont('Helvetica-Bold', 11)
        c.setFillColor(CREAM)
        c.drawString(MARGIN + 38, by + box_h - 18, a["name"])

        # Edad / Size pills
        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GRAY)
        c.drawString(MARGIN + 38 + c.stringWidth(a["name"], 'Helvetica-Bold', 11) + 14, by + box_h - 18, f"{a['age']} años")
        c.drawRightString(MARGIN + CONTENT_W - 12, by + box_h - 18, a["size"])

        # Descripción
        c.setFont('Helvetica', 9)
        c.setFillColor(GRAY)
        cy = by + box_h - 38
        words = a["desc"].split()
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, 'Helvetica', 9) > CONTENT_W - 28:
                c.setFillColor(CREAM2)
                c.drawString(MARGIN + 14, cy, line)
                cy -= 13
                line = w
            else:
                line = test
        if line:
            c.setFillColor(CREAM2)
            c.drawString(MARGIN + 14, cy, line)
            cy -= 13

        # 4 columnas de detalles
        rows = [
            ("DEMO", a["demo"]),
            ("INTERESES", a["intereses"]),
            ("GEO", a["geo"]),
            ("HORARIO PICO", a["horario"]),
        ]
        cy -= 4
        for label, val in rows:
            c.setFont('Helvetica-Bold', 7)
            c.setFillColor(GOLD)
            c.drawString(MARGIN + 14, cy, label)

            c.setFont('Helvetica', 7.5)
            c.setFillColor(GRAY)
            # truncar si muy largo
            max_w = CONTENT_W - 100
            if c.stringWidth(val, 'Helvetica', 7.5) > max_w:
                while c.stringWidth(val + "…", 'Helvetica', 7.5) > max_w:
                    val = val[:-1]
                val = val + "…"
            c.drawString(MARGIN + 80, cy, val)
            cy -= 11

        # Bottom row: ticket / platforms
        c.setStrokeColor(gold_alpha(0.18))
        c.setLineWidth(0.4)
        c.line(MARGIN + 14, by + 14, MARGIN + CONTENT_W - 14, by + 14)

        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawString(MARGIN + 14, by + 4, "TICKET")
        c.setFont('Helvetica-Bold', 9)
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(MARGIN + 50, by + 4, a["ticket"])

        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawRightString(MARGIN + CONTENT_W - 200, by + 4, "PLATAFORMAS")
        c.setFont('Helvetica', 8)
        c.setFillColor(CREAM2)
        c.drawRightString(MARGIN + CONTENT_W - 14, by + 4, a["platforms"])


def page_pilares(c, page_num, total):
    """Página 5: Los 5 pilares de contenido"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "04  ·  Pilares de contenido", "Cinco temas, // veinte anuncios.", y, italic_words=True)
    y -= 50

    intro = ("Cada anuncio que producimos cae en uno de estos cinco pilares. La proporción no es aleatoria: "
             "Tour 360° y la IA son nuestros diferenciales, así que dominan el calendario. Educación y Datos "
             "construyen autoridad. Casos cierran la confianza.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 12

    pillars = [
        {
            "n": "01",
            "name": "TOUR 360°",
            "weight": "30%",
            "tag": "DIFERENCIAL CORE",
            "desc": "El comprador está adentro de la casa antes de pisarla. Es el activo más vendedor que tenemos.",
            "formats": "Reels POV · Carousels antes/durante/después · Stories con tour link",
            "why": "Nadie en BB lo hace. Engagement promedio 3.2x más alto que fotos."
        },
        {
            "n": "02",
            "name": "LA IA EN ACCIÓN",
            "weight": "25%",
            "tag": "DIFERENCIAL CORE",
            "desc": "Mostrar a Camila respondiendo, agendando, calificando. La gente queda enganchada con \"una inmobiliaria que nunca duerme\".",
            "formats": "Reels screen-rec · Stories Q&A · Carousels \"5 cosas que hace por vos\"",
            "why": "Dispara curiosidad. Click-rate al WhatsApp +40% vs creatividad estándar."
        },
        {
            "n": "03",
            "name": "EDUCACIÓN FINANCIERA",
            "weight": "18%",
            "tag": "AUTORIDAD",
            "desc": "Créditos UVA, ley de alquileres, simuladores, qué barrios son aptos para crédito. Construye confianza antes de vender.",
            "formats": "Carousels educativos · Reels \"3 cosas que NO sabías\" · Lives mensuales",
            "why": "Salva-objeciones. Cuando llegan a Bochile ya están educados → cierran rápido."
        },
        {
            "n": "04",
            "name": "DATOS DEL MERCADO BB",
            "weight": "15%",
            "tag": "RELEVANCIA LOCAL",
            "desc": "Precio del m² por barrio, tendencias, zonas que vienen, comparativos. Bochile se posiciona como \"los que saben\" de BB.",
            "formats": "Carousels comparativos · Reels rankings · Mapas de calor",
            "why": "Compartido masivamente por bahienses. Orgánico potente."
        },
        {
            "n": "05",
            "name": "CASOS DE ÉXITO",
            "weight": "12%",
            "tag": "CIERRE / TRUST",
            "desc": "Familias que ya compraron con Bochile. Testimonios cortos, antes/después, historias humanas.",
            "formats": "Reels testimonio (15s) · Stories día-de-firma · Carousels familias",
            "why": "Trust máximo. Convierte el lead frío del retargeting."
        },
    ]

    pi_h = 88
    for i, p in enumerate(pillars):
        py = y - pi_h - i * (pi_h + 6)
        card(c, MARGIN, py, CONTENT_W, pi_h)

        # Número grande
        c.setFont('Times-Italic', 28)
        c.setFillColor(GOLD)
        c.drawString(MARGIN + 14, py + pi_h - 32, p["n"])

        # Weight badge top-right
        c.setFillColor(NAVY3)
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.6)
        wp = 50
        wph = 22
        c.roundRect(MARGIN + CONTENT_W - wp - 12, py + pi_h - wph - 10, wp, wph, 4, fill=1, stroke=1)
        c.setFont('Times-Roman', 13)
        c.setFillColor(GOLD_BRIGHT)
        c.drawCentredString(MARGIN + CONTENT_W - wp/2 - 12, py + pi_h - 24, p["weight"])

        # Tag
        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawString(MARGIN + 60, py + pi_h - 16, p["tag"])

        # Nombre
        c.setFont('Helvetica-Bold', 12)
        c.setFillColor(CREAM)
        c.drawString(MARGIN + 60, py + pi_h - 32, p["name"])

        # Descripción
        c.setFont('Helvetica', 8.5)
        c.setFillColor(GRAY)
        cy = py + pi_h - 47
        words = p["desc"].split()
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, 'Helvetica', 8.5) > CONTENT_W - 90:
                c.drawString(MARGIN + 60, cy, line)
                cy -= 11
                line = w
            else:
                line = test
        if line:
            c.drawString(MARGIN + 60, cy, line)
            cy -= 11

        # Formats + why
        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawString(MARGIN + 60, py + 18, "FORMATOS")
        c.drawString(MARGIN + 60, py + 8, "POR QUÉ FUNCIONA")

        c.setFont('Helvetica', 7.5)
        c.setFillColor(CREAM2)
        c.drawString(MARGIN + 110, py + 18, p["formats"])
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(MARGIN + 110, py + 8, p["why"])


# ============================================================
# 20 CONCEPTOS DE ADS - 4 páginas
# ============================================================

ADS = [
    # Pilar 1 - Tour 360
    ("01", "REEL · 30s", "TOUR 360°", "POV: estás recorriendo tu próxima casa. Sin moverte del sillón.",
     "Hook: \"Esta casa la recorrieron 487 personas el mes pasado SIN venir presencialmente.\" Cierre con \"Probalo vos\".",
     "Mandame TOUR y te paso el link al WhatsApp.", "A1 + A3", "Reels"),

    ("02", "CAROUSEL", "TOUR 360°", "Una casa, 5 caras: foto, 360°, plano, vista quincho, jardín.",
     "Slide 1: \"Esto te muestra la competencia.\" (foto). Slide 2-5: \"Esto te mostramos nosotros.\" Termina con \"Hay 240 propiedades como esta\".",
     "Mandame el barrio que te interesa.", "A1 + A2", "Feed IG"),

    ("03", "REEL · 15s", "TOUR 360°", "Split screen: \"Otras inmobiliarias\" vs \"Bochile\".",
     "Lado A: 3 fotos borrosas del sitio. Lado B: tour 360° fluido. Texto: \"¿En cuál ya querés vivir?\"",
     "Tour completo → mandame VER.", "A1", "Reels"),

    ("04", "STORY · 10s", "TOUR 360°", "\"Hoy alguien firmó esta casa sin venir nunca a verla.\"",
     "Imagen: tour 360° + tilde verde de \"firmado\". Caption: \"Y vos seguís yendo de inmobiliaria en inmobiliaria un sábado a la tarde.\"",
     "Sticker WhatsApp directo.", "A1 + A3", "Stories"),

    # Pilar 2 - IA
    ("05", "REEL · 20s", "LA IA", "Le pedí a Camila (IA) un dpto en Centro. En 3 minutos me mandó esto.",
     "Screen recording de WhatsApp real con Camila. Termina con: \"Probala. Atiende a las 3 AM.\"",
     "Escribile vos: link directo.", "A2 + A1", "Reels"),

    ("06", "CAROUSEL", "LA IA", "5 cosas que Camila (IA) hace antes de que hables con un humano.",
     "Slide 1-5: Califica · Manda matches · Agenda visita · Cotiza crédito · Recuerda papeles. Slide final: \"Y nunca duerme.\"",
     "Probala ahora → WhatsApp.", "A1 + A2 + A3", "Feed IG/FB"),

    ("07", "REEL · 25s", "LA IA", "\"Las inmobiliarias cierran a las 19. Camila atiende a las 3 AM.\"",
     "Time-lapse de la ciudad de noche con notificaciones de WhatsApp apareciendo. \"Mientras dormís, ella ya está calificando leads para vos.\"",
     "Hablá con Camila.", "A3 + A2", "Reels"),

    ("08", "STORY", "LA IA", "Quick poll: \"¿Cuántas inmobiliarias te dejaron en visto en BB?\"",
     "Sticker poll: 1-2 / 3-4 / 5+. Después: \"Bochile tiene una IA que te responde en 30 segundos.\"",
     "Sticker WhatsApp.", "A2", "Stories"),

    # Pilar 3 - Educación
    ("09", "REEL · 40s", "EDUCACIÓN", "3 cosas que NO te dijeron sobre el crédito UVA en 2026.",
     "Hook: \"Si estás esperando ahorrar todo en dólares, te están haciendo perder años.\" Educa rápido + cierra con simulador.",
     "Mandame UVA y te tasamos qué podés.", "A1", "Reels"),

    ("10", "CAROUSEL", "EDUCACIÓN", "El nuevo régimen de alquileres explicado en 6 slides.",
     "Slide 1: \"Lo que cambió en 2026.\" Slide 2-5: cada cambio clave. Slide 6: \"Tenés dudas? La IA te las saca.\"",
     "Hablamos por WhatsApp.", "A2 + A3", "Feed"),

    ("11", "REEL · 30s", "EDUCACIÓN", "Cuánto necesitás ahorrar para comprar en BB según el barrio.",
     "Hook visual: cifra grande de USD 80k → \"Patagonia\". 120k → \"Centro\". 280k → \"Palihue\". \"Y si no tenés todo en cash, te muestro cómo igual entra.\"",
     "Mandame BARRIO + tu presupuesto.", "A1 + A3", "Reels"),

    ("12", "STORY", "EDUCACIÓN", "Quiz: \"¿Estás listo para tu primer departamento? 3 preguntas.\"",
     "3 preguntas con sticker quiz: ingreso? ahorro? historia crediticia? Resultado custom + WhatsApp.",
     "Te cuento qué podés.", "A1 + A2", "Stories"),

    # Pilar 4 - Datos BB
    ("13", "REEL · 20s", "DATOS BB", "Top 5 barrios que MÁS subieron en BB este año.",
     "Conteo regresivo visual del 5 al 1 con cifras de % de aumento. Cierre: \"Si comprás en uno de estos, ganás antes de mudarte.\"",
     "Mandame INVERTIR.", "A3", "Reels"),

    ("14", "CAROUSEL", "DATOS BB", "Mapa de precios por m² · abril 2026 · Bahía Blanca.",
     "Mapa estilizado de BB con precio por barrio. Slide 2-9: zoom a cada zona. Final: \"Querés saber cuánto vale tu casa? Te tasamos en 2 horas.\"",
     "Mandame TASACIÓN gratis.", "A3", "Feed"),

    ("15", "REEL · 15s", "DATOS BB", "Por qué Patagonia es el barrio que viene.",
     "Visuales: obras nuevas, nuevo asfalto, valor en USD vs hace 3 años. \"Hoy un lote en Patagonia cuesta lo mismo que hace 5 años. En 2 años, no.\"",
     "Quiero ver lotes.", "A3 + A1", "Reels"),

    ("16", "STATIC POST", "DATOS BB", "Infografía: precio del alquiler por barrio en pesos.",
     "Diseño limpio con datos reales. Footer: \"Datos actualizados por la IA Bochile · todos los meses.\"",
     "DM para alquilar / publicar.", "A2 + A3", "Feed"),

    # Pilar 5 - Casos
    ("17", "REEL · 25s", "CASO ÉXITO", "Familia Beltrán encontró su casa en Palihue en 4 días.",
     "Testimonio rápido cliente real (con permiso). Foto familia + tour de la casa. \"Si ellos lo hicieron, vos también.\"",
     "Quiero empezar.", "A1", "Reels"),

    ("18", "STORY", "CASO ÉXITO", "Día de la firma. Reacción real al recibir las llaves.",
     "Video corto vertical (10-15s) sin música, audio crudo. Termina con logo Bochile.",
     "Sticker WhatsApp.", "A1 + A3", "Stories"),

    ("19", "CAROUSEL", "CASO ÉXITO", "Antes y después: PH Villa Mitre.",
     "5 slides: 1) Foto antes (deteriorado). 2-4) Reciclaje. 5) Hoy + valor. \"Comprado por Mariano en USD 65k, hoy vale USD 110k.\"",
     "Quiero invertir así.", "A3", "Feed"),

    ("20", "REEL · 30s", "CASO ÉXITO", "\"Andrea no tenía tiempo de buscar. Igual encontró.\"",
     "Mini-historia: trabajo full + 2 hijos. Camila hizo el match. Visita un sábado, firma 2 semanas después.",
     "Camila te ayuda igual.", "A1 + A2", "Reels"),
]


def page_ads_intro(c, page_num, total):
    """Página 6: Intro 20 ads"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "05  ·  Veinte anuncios listos", "El arsenal // de los próximos noventa días.", y, italic_words=True)
    y -= 50

    intro = ("Estos son los 20 conceptos para producir el primer mes — distribuidos por pilar y por audiencia. "
             "Cada uno tiene hook, copy y CTA. Producimos en olas: 6 el primer sprint, 7 el segundo, 7 el tercero. "
             "Los que ganen se reproducen con variantes. Los que pierdan, fuera.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 12

    # Mini-grid resumen 5 pilares con cantidad
    pilarsum = [
        ("TOUR 360°", "4 ads", "Reels + Carousel + Story", GOLD_BRIGHT),
        ("LA IA EN ACCIÓN", "4 ads", "Reels + Carousel + Story", GOLD_BRIGHT),
        ("EDUCACIÓN", "4 ads", "Reels + Carousel + Story", GOLD),
        ("DATOS DEL MERCADO BB", "4 ads", "Reels + Carousel + Static + Reels", GOLD),
        ("CASOS DE ÉXITO", "4 ads", "Reels + Stories + Carousel", GOLD),
    ]

    cols = 1
    box_h = 38
    for i, (name, qty, fmts, col) in enumerate(pilarsum):
        py = y - box_h - i * (box_h + 6)
        card(c, MARGIN, py, CONTENT_W, box_h, fill=NAVY3)

        c.setFillColor(col)
        c.rect(MARGIN, py, 4, box_h, fill=1, stroke=0)

        c.setFont('Helvetica-Bold', 9.5)
        c.setFillColor(CREAM)
        c.drawString(MARGIN + 16, py + box_h - 16, name)

        c.setFont('Times-Italic', 11)
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(MARGIN + 220, py + box_h - 16, qty)

        c.setFont('Helvetica', 8)
        c.setFillColor(GRAY)
        c.drawString(MARGIN + 16, py + 12, fmts)

        # Lo que viene
        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawRightString(MARGIN + CONTENT_W - 14, py + 12, f"VER ANUNCIOS {i*4+1:02d}-{(i+1)*4:02d}")

    y = y - box_h * 5 - 30

    # Cierre
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(MARGIN, 110, MARGIN, 60)

    c.setFont('Times-Italic', 12)
    c.setFillColor(CREAM)
    c.drawString(MARGIN + 14, 96, "Cada anuncio en las páginas que siguen está listo para")
    c.drawString(MARGIN + 14, 80, "pasar a producción esta semana. Hook, copy, CTA, audiencia,")
    c.drawString(MARGIN + 14, 64, "formato y plataforma — todo definido.")


def render_ad_card(c, ad, x, y, w, h):
    """Card individual de un anuncio"""
    num, fmt, pilar, hook, body, cta, audience, placement = ad
    card(c, x, y, w, h, fill=NAVY2)

    # Top bar
    c.setFillColor(NAVY3)
    c.rect(x + 1, y + h - 26, w - 2, 25, fill=1, stroke=0)

    # Número grande
    c.setFont('Times-Italic', 16)
    c.setFillColor(GOLD_BRIGHT)
    c.drawString(x + 12, y + h - 18, num)

    # Pilar tag
    c.setFont('Helvetica-Bold', 6.5)
    c.setFillColor(GOLD)
    c.drawString(x + 38, y + h - 16, pilar)

    # Formato
    c.setFont('Helvetica-Bold', 7)
    c.setFillColor(CREAM)
    c.drawRightString(x + w - 12, y + h - 16, fmt)

    # Hook (título del ad)
    c.setFont('Helvetica-Bold', 9)
    c.setFillColor(CREAM)
    cy = y + h - 38
    words = hook.split()
    line = ""
    for w_word in words:
        test = (line + " " + w_word).strip()
        if c.stringWidth(test, 'Helvetica-Bold', 9) > w - 24:
            c.drawString(x + 12, cy, line)
            cy -= 12
            line = w_word
        else:
            line = test
    if line:
        c.drawString(x + 12, cy, line)
        cy -= 12

    cy -= 4

    # Body / copy
    c.setFont('Helvetica', 7.5)
    c.setFillColor(GRAY)
    words = body.split()
    line = ""
    for w_word in words:
        test = (line + " " + w_word).strip()
        if c.stringWidth(test, 'Helvetica', 7.5) > w - 24:
            c.drawString(x + 12, cy, line)
            cy -= 10.5
            line = w_word
        else:
            line = test
    if line:
        c.drawString(x + 12, cy, line)
        cy -= 10.5

    # Bottom
    c.setStrokeColor(gold_alpha(0.18))
    c.setLineWidth(0.4)
    c.line(x + 12, y + 32, x + w - 12, y + 32)

    # CTA
    c.setFont('Helvetica-Bold', 6.5)
    c.setFillColor(GOLD)
    c.drawString(x + 12, y + 22, "CTA")
    c.setFont('Helvetica', 7.5)
    c.setFillColor(GOLD_BRIGHT)
    cta_text = cta if c.stringWidth(cta, 'Helvetica', 7.5) < w - 60 else cta[:50] + "…"
    c.drawString(x + 32, y + 22, cta_text)

    # Audience + placement
    c.setFont('Helvetica-Bold', 6.5)
    c.setFillColor(GOLD)
    c.drawString(x + 12, y + 8, "AUD")
    c.setFont('Helvetica', 7)
    c.setFillColor(CREAM2)
    c.drawString(x + 32, y + 8, audience)

    c.setFont('Helvetica-Bold', 6.5)
    c.setFillColor(GOLD)
    c.drawRightString(x + w - 50, y + 8, "PLACEMENT")
    c.setFont('Helvetica', 7)
    c.setFillColor(CREAM2)
    c.drawRightString(x + w - 12, y + 8, placement)


def page_ads_grid(c, page_num, total, ads_subset, page_title_eyebrow):
    """Página con grid 2x2 de ads"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, page_title_eyebrow, "Hooks que // detienen el scroll.", y, italic_words=True)
    y -= 50

    intro = "Cada caja es un anuncio listo para producción. La columna izquierda son los más importantes — los que abren la audiencia."
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9, leading=13)
    y -= 8

    # Grid 2 cols x 3 filas
    cols = 2
    rows = (len(ads_subset) + cols - 1) // cols
    gap = 10
    box_w = (CONTENT_W - gap) / cols
    box_h = 156

    for i, ad in enumerate(ads_subset):
        col = i % cols
        row = i // cols
        bx = MARGIN + col * (box_w + gap)
        by = y - box_h - row * (box_h + gap)
        render_ad_card(c, ad, bx, by, box_w, box_h)


def page_calendario(c, page_num, total):
    """Página: Calendario 90 días"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "06  ·  Calendario 90 días", "Aprender, // optimizar, escalar.", y, italic_words=True)
    y -= 50

    intro = ("Tres fases. La primera no la ganamos con creatividades — la ganamos midiendo. "
             "La segunda separamos winners de losers. La tercera escalamos solo lo que paga.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 14

    phases = [
        {
            "n": "FASE 1", "title": "APRENDER", "weeks": "Semanas 1-4",
            "color": GOLD_BRIGHT,
            "budget": "USD 350-400",
            "objetivo": "Encontrar la audiencia + creatividad ganadora.",
            "items": [
                "Sem 1: Lanzar 6 ads (1 por pilar + 1 extra). Test de audiencia A1.",
                "Sem 2: Sumar 7 ads. Test audiencia A2 (jóvenes).",
                "Sem 3: Sumar 7 ads. Test audiencia A3 (propietarios) + retargeting #1.",
                "Sem 4: Pausar bottom 50%. Mantener winners. Decidir tier 2."
            ]
        },
        {
            "n": "FASE 2", "title": "OPTIMIZAR", "weeks": "Semanas 5-8",
            "color": GOLD,
            "budget": "USD 600-800 (si CPC < $0.15)",
            "objetivo": "Achicar el funnel, subir frecuencia, lanzar lookalikes.",
            "items": [
                "Sem 5: Crear lookalike 1% sobre quienes mandaron mensaje en mes 1.",
                "Sem 6: Variantes de los 4 winners (cambio de hook).",
                "Sem 7: Retargeting completo: visitantes web + IG no convertidos.",
                "Sem 8: Cross-pollination: ads del pilar IA en audiencia A3 (sorpresa)."
            ]
        },
        {
            "n": "FASE 3", "title": "ESCALAR", "weeks": "Semanas 9-12",
            "color": GOLD,
            "budget": "USD 1.000-2.000 (si ROAS > 4x)",
            "objetivo": "Más presupuesto sin perder eficiencia. Dominio local.",
            "items": [
                "Sem 9: Subir budget gradual 30% / 30% / 40% en days 1-3-7.",
                "Sem 10: Lanzar TikTok Ads en paralelo (mismas creatividades reels).",
                "Sem 11: 2 ads de \"awareness\" para top of mind BB.",
                "Sem 12: Reporte ejecutivo. Definir tier 4 o sostener."
            ]
        }
    ]

    fh = 144
    for i, p in enumerate(phases):
        py = y - fh - i * (fh + 8)
        card(c, MARGIN, py, CONTENT_W, fh)

        # Header
        c.setFillColor(p["color"])
        c.rect(MARGIN, py + fh - 4, CONTENT_W, 4, fill=1, stroke=0)

        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(p["color"])
        c.drawString(MARGIN + 14, py + fh - 18, p["n"])

        c.setFont('Times-Italic', 16)
        c.setFillColor(CREAM)
        c.drawString(MARGIN + 60, py + fh - 18, p["title"])

        c.setFont('Helvetica', 8)
        c.setFillColor(GRAY)
        c.drawString(MARGIN + 60 + c.stringWidth(p["title"], 'Times-Italic', 16) + 10, py + fh - 18, "·  " + p["weeks"])

        # Budget right
        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawRightString(MARGIN + CONTENT_W - 14, py + fh - 18, "BUDGET")
        c.setFont('Helvetica-Bold', 9)
        c.setFillColor(GOLD_BRIGHT)
        c.drawRightString(MARGIN + CONTENT_W - 14, py + fh - 30, p["budget"])

        # Objetivo
        c.setFont('Helvetica-Bold', 7)
        c.setFillColor(GOLD)
        c.drawString(MARGIN + 14, py + fh - 42, "OBJETIVO")
        c.setFont('Helvetica', 9)
        c.setFillColor(CREAM2)
        c.drawString(MARGIN + 70, py + fh - 42, p["objetivo"])

        # Items
        cy = py + fh - 60
        for item in p["items"]:
            c.setFillColor(GOLD)
            c.circle(MARGIN + 18, cy + 2, 1.5, fill=1, stroke=0)
            c.setFont('Helvetica', 8.5)
            c.setFillColor(CREAM2)
            # bold first part
            parts = item.split(":", 1)
            if len(parts) == 2:
                c.setFont('Helvetica-Bold', 8.5)
                c.setFillColor(GOLD_BRIGHT)
                c.drawString(MARGIN + 26, cy, parts[0] + ":")
                bw = c.stringWidth(parts[0] + ":", 'Helvetica-Bold', 8.5)
                c.setFont('Helvetica', 8.5)
                c.setFillColor(CREAM2)
                c.drawString(MARGIN + 26 + bw + 4, cy, parts[1].strip())
            else:
                c.drawString(MARGIN + 26, cy, item)
            cy -= 14


def page_budget(c, page_num, total):
    """Página: Budget breakdown"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "07  ·  Cómo invertir el dinero", "Cuatrocientos // dólares con ojo.", y, italic_words=True)
    y -= 50

    intro = ("Tier inicial: USD 400 / mes. Al cambio de abril 2026 son aproximadamente $530.000 ARS. "
             "El secreto no es gastar más sino dirigir mejor.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 18

    # Distribución del presupuesto - barras
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN, y, "DISTRIBUCIÓN DEL BUDGET MENSUAL")
    y -= 16

    items = [
        ("Campaña 1 · Audiencia A1 (familias)", 160, GOLD_BRIGHT, "40%", "Mayor ticket, mayor LTV"),
        ("Campaña 2 · Audiencia A2 (jóvenes)", 100, GOLD, "25%", "Volumen alto, alquiler"),
        ("Campaña 3 · Audiencia A3 (propietarios)", 100, GOLD, "25%", "Captación de oferta"),
        ("Reserva creatividad rápida (boosting)", 40, GRAY, "10%", "Reels que pegan + retargeting"),
    ]

    bar_max_w = CONTENT_W - 220
    for i, (name, usd, col, pct, why) in enumerate(items):
        cy = y - i * 32
        # nombre
        c.setFont('Helvetica-Bold', 9)
        c.setFillColor(CREAM)
        c.drawString(MARGIN, cy, name)
        # why
        c.setFont('Helvetica', 7.5)
        c.setFillColor(GRAY)
        c.drawString(MARGIN, cy - 12, why)
        # bar
        bar_w = (usd / 200) * bar_max_w
        c.setFillColor(NAVY3)
        c.roundRect(MARGIN + 200, cy - 4, bar_max_w, 12, 3, fill=1, stroke=0)
        c.setFillColor(col)
        c.roundRect(MARGIN + 200, cy - 4, bar_w, 12, 3, fill=1, stroke=0)
        # value
        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(MARGIN + 200 + bar_max_w + 8, cy, f"$ {usd}")
        c.setFont('Helvetica', 7)
        c.setFillColor(GRAY2)
        c.drawString(MARGIN + 200 + bar_max_w + 8, cy - 10, pct)

    y -= 32 * 4 + 20

    # Total caja
    box_h = 86
    c.setFillColor(NAVY2)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.roundRect(MARGIN, y - box_h, CONTENT_W, box_h, 6, fill=1, stroke=1)

    # Divisor vertical sutil
    c.setStrokeColor(gold_alpha(0.25))
    c.setLineWidth(0.5)
    c.line(MARGIN + CONTENT_W * 0.55, y - 20, MARGIN + CONTENT_W * 0.55, y - box_h + 14)

    # IZQUIERDA: Total
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN + 18, y - 22, "TOTAL MES 1")

    c.setFont('Times-Roman', 30)
    c.setFillColor(GOLD_BRIGHT)
    c.drawString(MARGIN + 18, y - 52, "USD 400")

    c.setFont('Helvetica', 8.5)
    c.setFillColor(GRAY)
    c.drawString(MARGIN + 18, y - 68, "≈ $530.000 ARS  ·  ≈ $13.300 ARS / día")

    # DERECHA: Forecast
    rx = MARGIN + CONTENT_W * 0.58
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(rx, y - 22, "FORECAST")

    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(CREAM)
    c.drawString(rx, y - 40, "250 - 350")
    c.setFont('Helvetica', 8.5)
    c.setFillColor(GRAY)
    c.drawString(rx, y - 52, "conversaciones / mes")

    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(CREAM)
    c.drawString(rx + 130, y - 40, "USD 1.15 - 1.60")
    c.setFont('Helvetica', 8.5)
    c.setFillColor(GRAY)
    c.drawString(rx + 130, y - 52, "cost por conversación")

    c.setFont('Helvetica', 7.5)
    c.setFillColor(GOLD_BRIGHT)
    c.drawString(rx, y - 68, "Cobro automático por Meta · factura electrónica")

    y -= box_h + 20

    # Cómo Meta cobra
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN, y, "FACTURACIÓN Y COBRO")
    y -= 16

    cobro = ("Meta cobra automáticamente cada vez que el balance llega al límite (ej. cada $50 USD), "
             "o el día 1 de cada mes — lo que ocurra primero. Pago con tarjeta de crédito o débito en USD. "
             "Bochile recibe factura electrónica de Meta Ireland por el total mensual.")
    y = draw_text_block(c, cobro, MARGIN, y, CONTENT_W, color=GRAY, size=9, leading=13)


def page_kpis(c, page_num, total):
    """Página: KPIs y métricas"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "08  ·  KPIs", "Lo que // se mide.", y, italic_words=True)
    y -= 50

    intro = ("Estos seis números deciden si la campaña funciona. Si tres están en verde, escalamos. "
             "Si tres están en rojo dos semanas seguidas, replanteamos.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 14

    kpis = [
        ("CPC · Cost per click", "< $ 0.15 USD", "Mide la calidad de la creatividad. Si sube, rotamos creativo."),
        ("CR a conversación", "> 25 %", "De los que clickean, cuántos escriben. Si baja, hook débil."),
        ("Cost per conversación", "< $ 1.60 USD", "El número rey. Combina los dos anteriores."),
        ("Conversaciones / mes", "250 - 350", "Volumen total. Define ROAS final."),
        ("Conv → Visita", "> 18 %", "Trabajo de la IA + vendedor. Si baja, ajustamos guión."),
        ("ROAS · mes 3", "> 4 x", "Por cada $1 invertido, $4 en comisiones. Habilita escalar."),
    ]

    box_w = (CONTENT_W - 14) / 2
    box_h = 70
    for i, (name, target, desc) in enumerate(kpis):
        col = i % 2
        row = i // 2
        bx = MARGIN + col * (box_w + 14)
        by = y - row * (box_h + 10) - box_h
        card(c, bx, by, box_w, box_h)

        c.setFont('Helvetica-Bold', 8.5)
        c.setFillColor(CREAM)
        c.drawString(bx + 14, by + box_h - 16, name)

        c.setFont('Times-Roman', 18)
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(bx + 14, by + box_h - 38, target)

        c.setFont('Helvetica', 7.5)
        c.setFillColor(GRAY)
        # wrap desc
        words = desc.split()
        line = ""
        cy = by + 18
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, 'Helvetica', 7.5) > box_w - 28:
                c.drawString(bx + 14, cy, line)
                cy -= 10
                line = w
            else:
                line = test
        if line:
            c.drawString(bx + 14, cy, line)

    y -= (box_h + 10) * 3 + 8

    # Frecuencia de revisión
    rev_y = y - 80
    card(c, MARGIN, rev_y, CONTENT_W, 80, fill=NAVY3)

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN + 16, rev_y + 60, "FRECUENCIA DE REVISIÓN")

    rev_items = [
        ("Diario · 5 min", "CPC + conversaciones del día"),
        ("Semanal · 30 min", "Pausar / mantener creatividades + ajustar audiencias"),
        ("Mensual · 90 min", "Reporte ejecutivo a Bochile + decisión escalado"),
    ]
    cy = rev_y + 42
    for label, body in rev_items:
        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(GOLD_BRIGHT)
        c.drawString(MARGIN + 16, cy, label)
        c.setFont('Helvetica', 8.5)
        c.setFillColor(CREAM2)
        c.drawString(MARGIN + 110, cy, body)
        cy -= 14


def page_escalamiento(c, page_num, total):
    """Página: Roadmap de escalamiento"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "09  ·  Escalamiento", "Cómo subir // sin romper la máquina.", y, italic_words=True)
    y -= 50

    intro = ("Subir el budget mal mata la campaña: Meta tiene que reaprender, sube CPC, baja CR. "
             "Estas son las reglas de oro para escalar sin perder eficiencia.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 14

    # Tabla escalamiento
    rows = [
        ["TIER", "USD / MES", "ARS / MES", "CONV / MES", "CONDICIÓN", "CUANDO"],
        ["Inicial", "$ 350-500", "$465-665k", "250-350", "Arrancamos acá", "Mes 1"],
        ["Crecimiento", "$ 800-1.500", "$1.06-2M", "500-1.200", "CPC < $0.15 + CR > 25%", "Mes 2-3"],
        ["Escala", "$ 2.000-4.000", "$2.6-5.3M", "1.500-3.500", "ROAS > 4x + 2 cierres", "Mes 4+"],
        ["Dominio", "$ 5.000+", "$6.6M+", "4.000+", "Top 3 BB en saturación", "Mes 6+"],
    ]

    col_w = [70, 75, 75, 75, 145, 65]
    th = 28
    for i, row in enumerate(rows):
        ry = y - th * (i + 1)
        is_header = i == 0

        if is_header:
            c.setFillColor(NAVY3)
            c.rect(MARGIN, ry, CONTENT_W, th, fill=1, stroke=0)
        elif i % 2 == 1:
            c.setFillColor(NAVY2)
            c.rect(MARGIN, ry, CONTENT_W, th, fill=1, stroke=0)

        # Línea inferior
        c.setStrokeColor(gold_alpha(0.18))
        c.setLineWidth(0.4)
        c.line(MARGIN, ry, MARGIN + CONTENT_W, ry)

        cx = MARGIN + 8
        for j, cell in enumerate(row):
            if is_header:
                c.setFont('Helvetica-Bold', 7)
                c.setFillColor(GOLD)
            else:
                if j == 0:  # Tier name
                    c.setFont('Times-Italic', 11)
                    c.setFillColor(GOLD_BRIGHT)
                elif j == 1 or j == 3:
                    c.setFont('Helvetica-Bold', 9)
                    c.setFillColor(CREAM)
                else:
                    c.setFont('Helvetica', 8)
                    c.setFillColor(GRAY)

            c.drawString(cx, ry + th/2 - 3, cell)
            cx += col_w[j]

    # Línea final
    c.setStrokeColor(gold_alpha(0.18))
    c.line(MARGIN, y - th * len(rows), MARGIN + CONTENT_W, y - th * len(rows))

    y -= th * len(rows) + 22

    # 4 reglas oro
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GOLD)
    c.drawString(MARGIN, y, "REGLAS DE ORO PARA ESCALAR SIN ROMPER")
    y -= 16

    rules = [
        "Subir budget máximo 30% por vez. Si el algoritmo aprende, sigue. Si rompe, baja.",
        "Nunca escalar antes del día 4 de un ad set. Meta necesita 3 días para encontrar audiencia.",
        "Si CPC sube > 25%, parás 24h, no apagás. A veces es solo el algoritmo recalibrando.",
        "Una creatividad que pasa de 1.5M de impresiones se reemplaza, sin importar CTR. Fatiga es real."
    ]

    for r in rules:
        c.setFillColor(GOLD)
        c.circle(MARGIN + 6, y + 2, 1.8, fill=1, stroke=0)
        c.setFont('Helvetica', 9)
        c.setFillColor(CREAM2)
        # wrap
        words = r.split()
        line = ""
        cx = MARGIN + 16
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, 'Helvetica', 9) > CONTENT_W - 20:
                c.drawString(cx, y, line)
                y -= 13
                line = w
            else:
                line = test
        if line:
            c.drawString(cx, y, line)
            y -= 18


def page_reglas(c, page_num, total):
    """Página: 12 reglas para CPC bajo"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "10  ·  Las doce reglas", "Cómo mantener // el CPC bajo.", y, italic_words=True)
    y -= 50

    intro = ("Compilado de lo que aprendimos haciendo Ads para inmobiliarias. La diferencia entre $0.10 "
             "y $0.40 está en estas doce reglas. La inmobiliaria que las cumple paga 4x menos por cada lead.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=GRAY, size=9.5, leading=14)
    y -= 12

    rules = [
        ("Hook en los primeros 3 segundos.", "Reels: el patrón de scroll se decide en el segundo 1. Texto grande, contraste alto, audio impactante o silencio total."),
        ("Click-to-WhatsApp objective siempre.", "No \"tráfico\". No \"engagement\". Solo Mensajes. Meta optimiza por la conversión que pedís."),
        ("Audiencia chica y caliente.", "BB + 30 km, no \"todo Argentina\". 80-150k personas por ad set, no 2M."),
        ("Un ad set por audiencia.", "No mezclar A1 + A2 en el mismo set. Meta no sabe a quién priorizar y sube el costo."),
        ("Rotar creatividad cada 7-10 días.", "La fatiga es real. Una pieza que arrancó en $0.10 puede subir a $0.30 a los 14 días."),
        ("Subtítulos quemados en video.", "85% de Reels se ven sin sonido. Si el video depende del audio, perdiste."),
        ("Vertical 9:16 obligatorio.", "Meta prioriza vertical en feed e historia. Horizontal duplica el CPC."),
        ("UGC siempre que se pueda.", "Video casero del vendedor mostrando una propiedad supera a producción profesional 3 de cada 4 veces."),
        ("CTA explícito.", "\"Mandanos un mensaje\" no \"contactanos\". Cuanto más concreto, mejor CR."),
        ("Cero jerga inmobiliaria.", "\"Apto crédito\", \"FOT 1.2\", \"con cláusula\" no convierten. Hablar como un vecino."),
        ("Test 4 hooks por concepto.", "Misma creatividad, 4 hooks distintos. Quedate con el que tenga 2x mejor CTR."),
        ("Comentarios y respuestas en horas.", "Meta premia el engagement. La IA responde mensajes en 30 segundos. Aprovechemos.")
    ]

    cols = 2
    box_w = (CONTENT_W - 12) / cols
    box_h = 50
    for i, (title, body) in enumerate(rules):
        col = i % cols
        row = i // cols
        bx = MARGIN + col * (box_w + 12)
        by = y - box_h - row * (box_h + 6)
        card(c, bx, by, box_w, box_h, fill=NAVY3, stroke_alpha=0.12)

        # Number circle
        c.setFillColor(GOLD)
        c.circle(bx + 16, by + box_h - 16, 8, fill=1, stroke=0)
        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(NAVY)
        c.drawCentredString(bx + 16, by + box_h - 18.5, str(i + 1).zfill(2))

        # Title
        c.setFont('Helvetica-Bold', 8.5)
        c.setFillColor(CREAM)
        c.drawString(bx + 32, by + box_h - 14, title)

        # Body
        c.setFont('Helvetica', 7.5)
        c.setFillColor(GRAY)
        words = body.split()
        line = ""
        cy = by + box_h - 27
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, 'Helvetica', 7.5) > box_w - 40:
                c.drawString(bx + 32, cy, line)
                cy -= 10
                line = w
            else:
                line = test
        if line:
            c.drawString(bx + 32, cy, line)


def page_cierre(c, page_num, total):
    """Página final: Cierre + próximos pasos"""
    page_chrome(c, page_num, total)
    y = PAGE_H - 80
    section_header(c, "11  ·  Próximos pasos", "Catorce días // para arrancar.", y, italic_words=True)
    y -= 50

    intro = ("Si Bochile aprueba este roadmap hoy, en 14 días estamos en el aire. WESEKA hace toda la "
             "operativa — Bochile solo aprueba creatividades.")
    y = draw_text_block(c, intro, MARGIN, y, CONTENT_W, color=CREAM2, size=10, leading=15)
    y -= 16

    # Timeline 14 días
    timeline = [
        ("Día 1-2", "Aprobación + setup", "Bochile aprueba budget + creatividades. WESEKA configura cuenta Meta Ads, instala pixel, conecta WhatsApp Business API."),
        ("Día 3-5", "Producción ola 1", "Producimos los primeros 6 anuncios (2 por pilar prioritario). Aprobación Bochile en 24h por video corto."),
        ("Día 6-8", "Carga y QA", "Subir creativos a Meta. Configurar 3 ad sets con 3 audiencias. Setup tracking + UTMs."),
        ("Día 9", "LANZAMIENTO", "Activamos campañas. WESEKA monitorea primeras 48h."),
        ("Día 10-13", "Optimización inicial", "Pausar bottom 30% si CPC > $0.20. Reasignar budget al top 50%."),
        ("Día 14", "Reporte semana 1", "Primeros números reales para Bochile + plan para semana 2.")
    ]

    th = 32
    for i, (day, title, body) in enumerate(timeline):
        cy = y - i * th
        # Línea vertical
        c.setStrokeColor(gold_alpha(0.4))
        c.setLineWidth(0.6)
        c.line(MARGIN + 70, cy + 14, MARGIN + 70, cy - 14)

        # Punto
        c.setFillColor(NAVY)
        c.setStrokeColor(GOLD)
        c.setLineWidth(1)
        c.circle(MARGIN + 70, cy, 4, fill=1, stroke=1)

        # Día
        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(GOLD)
        c.drawRightString(MARGIN + 60, cy - 2, day.upper())

        # Title
        c.setFont('Helvetica-Bold', 9.5)
        c.setFillColor(CREAM)
        c.drawString(MARGIN + 84, cy + 2, title)

        # Body
        c.setFont('Helvetica', 8)
        c.setFillColor(GRAY)
        # truncate if needed
        max_w = CONTENT_W - 100
        if c.stringWidth(body, 'Helvetica', 8) > max_w:
            while c.stringWidth(body + "…", 'Helvetica', 8) > max_w:
                body = body[:-1]
            body = body + "…"
        c.drawString(MARGIN + 84, cy - 9, body)

    y -= th * len(timeline) + 12

    # Caja final con firma WESEKA
    c.setFillColor(NAVY3)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.roundRect(MARGIN, y - 90, CONTENT_W, 90, 8, fill=1, stroke=1)

    c.setFont('Helvetica-Bold', 7)
    c.setFillColor(GOLD)
    c.drawString(MARGIN + 18, y - 18, "WESEKA · IA")

    c.setFont('Times-Italic', 17)
    c.setFillColor(CREAM)
    c.drawString(MARGIN + 18, y - 42, "El plan está. La infraestructura está.")
    c.setFont('Times-Italic', 17)
    c.setFillColor(GOLD_BRIGHT)
    c.drawString(MARGIN + 18, y - 62, "Falta apretar play.")

    c.setFont('Helvetica', 8.5)
    c.setFillColor(GRAY)
    c.drawString(MARGIN + 18, y - 80, "Preparado por WESEKA.IA  ·  Reunión Bochile  ·  29 abril 2026  ·  16:00 hs")


# ============================================================
# BUILD MAIN
# ============================================================

def build():
    c = canvas.Canvas(OUTPUT_PATH, pagesize=A4)
    c.setTitle("WESEKA.IA · Roadmap META Ads · Bochile")
    c.setAuthor("WESEKA.IA")
    c.setSubject("Estrategia de adquisición META Ads para Inmobiliaria Bochile")

    TOTAL = 17  # cover + 16 páginas internas

    # 1. Cover
    cover_page(c, TOTAL)
    c.showPage()
    # 2. Resumen
    page_resumen(c, 2, TOTAL)
    c.showPage()
    # 3. Estrategia Click-to-WhatsApp
    page_estrategia(c, 3, TOTAL)
    c.showPage()
    # 4. Audiencias
    page_audiencias(c, 4, TOTAL)
    c.showPage()
    # 5. Pilares
    page_pilares(c, 5, TOTAL)
    c.showPage()
    # 6. Intro 20 ads
    page_ads_intro(c, 6, TOTAL)
    c.showPage()
    # 7-10. Ads grids (4 páginas, 5 ads cada una... mejor 4-4-4-4-4 = 5 páginas, o 5-5-5-5)
    # Tenemos 20 ads, hagamos 4 páginas de 5 ads cada una = no, son 20 / 4 = 5 ads / pag pero queda raro grid
    # Mejor 4 páginas con 6 ads (grid 2x3) y la última con 2 = total 4 páginas con grid 2x3 = 24 slots, sobran 4
    # O: grid 2x3 = 6 ads, x4 pags = 24. Tenemos 20. Mejor grid 2x2 = 4 ads/pag, x5 pags = 20.
    # Vamos con 5 páginas de 4 ads cada una.
    for i in range(5):
        ads_subset = ADS[i*4:(i+1)*4]
        eyebrow = f"05  ·  Anuncios listos  ·  {i*4+1:02d}-{(i+1)*4:02d}"
        page_ads_grid(c, 7+i, TOTAL, ads_subset, eyebrow)
        c.showPage()
    # Después de las 5 paginas de ads = 7,8,9,10,11
    # 12. Calendario
    page_calendario(c, 12, TOTAL)
    c.showPage()
    # 13. Budget
    page_budget(c, 13, TOTAL)
    c.showPage()
    # 14. KPIs
    page_kpis(c, 14, TOTAL)
    c.showPage()
    # 15. Escalamiento
    page_escalamiento(c, 15, TOTAL)
    c.showPage()
    # 16. Reglas
    page_reglas(c, 16, TOTAL)
    c.showPage()
    # 17. Cierre
    page_cierre(c, 17, TOTAL)
    c.showPage()

    c.save()
    print(f"PDF generated: {OUTPUT_PATH}")
    print(f"Total pages: 17")


if __name__ == "__main__":
    build()
