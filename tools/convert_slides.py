# แปลง PDF ในโฟลเดอร์ ข้อมูล/ เป็นรูป WebP ทีละหน้า → slides/<รหัส>/001.webp ...
# วิธีใช้ (รันจากโฟลเดอร์โปรเจค):  python tools/convert_slides.py
# ต้องมี: pip install pymupdf pillow
# เมื่อเพิ่ม/แก้ PDF → แก้ตาราง COURSES ด้านล่าง แล้วรันใหม่ และอัปเดตจำนวนหน้าใน index.html (COURSES)
import io, os, sys, shutil
import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "ข้อมูล")
OUT = os.path.join(ROOT, "slides")

# รหัส : (ชื่อไฟล์ PDF, ความกว้างรูปเป็น px)
COURSES = {
    "general":   ("1.อบรมผู้รับหมางานทั่วไป.pdf", 1280),
    "hotwork":   ("2.อบรมผู้รับหมางานก่อประกายไฟ.pdf", 1280),
    "height":    ("3.อบรมการทำงานที่สูง.pdf", 1280),
    "confined":  ("4.อบรมการทำงานที่อับอากาศ.pdf", 1280),
    "flowchart": ("Flow Chart Work Permit .pdf", 1400),          # A4 แนวตั้ง ตัวหนังสือเล็ก ต้องละเอียดกว่า
    "sdsf00":    ("SD-SF-00 ข้อปฏิบัติด้านความปลอดภัย .pdf", 1800),  # A4 แนวนอน ตัวหนังสือเล็ก
}
QUALITY = 74

def convert(code, filename, width):
    pdf_path = os.path.join(SRC, filename)
    if not os.path.exists(pdf_path):
        print(f"[ข้าม] ไม่พบไฟล์ {pdf_path}")
        return 0
    out_dir = os.path.join(OUT, code)
    shutil.rmtree(out_dir, ignore_errors=True)  # ล้างเฉพาะรูปของหลักสูตรนี้ (สร้างใหม่ได้เสมอจาก PDF)
    os.makedirs(out_dir)
    doc = pymupdf.open(pdf_path)
    total = 0
    n = 0             # จำนวนหน้าที่เขียนจริง (หลังตัดหน้าซ้ำ)
    prev = None       # pixel ของหน้าก่อน ใช้ตรวจหน้าซ้ำ
    skipped = []
    for i, page in enumerate(doc):
        zoom = width / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        # หน้าที่หน้าตาเหมือนหน้าก่อนทุกพิกเซล = สไลด์ซ้ำใน PDF → ข้าม
        if prev is not None and pix.samples == prev:
            skipped.append(i + 1)
            continue
        prev = pix.samples
        n += 1
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        dest = os.path.join(out_dir, f"{n:03d}.webp")
        img.save(dest, "WEBP", quality=QUALITY, method=6)
        total += os.path.getsize(dest)
    note = f"  (ตัดหน้าซ้ำใน PDF: {skipped})" if skipped else ""
    print(f"{code:10s} {n:3d} หน้า  {pix.width}x{pix.height}  รวม {total / 1048576:.1f} MB{note}")
    return n

if __name__ == "__main__":
    for code, (fn, w) in COURSES.items():
        convert(code, fn, w)
