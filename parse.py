import msoffcrypto
import xlrd
import os

file_path = 'PM Cocos preenchidas - SICONFI_RGF_2908101_20260105_v14 (1).xls'
decrypted_path = 'decrypted.xls'

with open(file_path, 'rb') as f:
    office_file = msoffcrypto.OfficeFile(f)
    office_file.load_key(password='VelvetSweatshop')
    with open(decrypted_path, 'wb') as out_file:
        office_file.decrypt(out_file)

wb = xlrd.open_workbook(decrypted_path)
for n in wb.sheet_names():
    if 'Anexo 02' in n or 'Anexo 05' in n or 'Anexo 2' in n or 'Anexo 5' in n:
        sheet = wb.sheet_by_name(n)
        for r in range(sheet.nrows):
            row_vals = [str(x) for x in sheet.row_values(r)]
            text = ' '.join(row_vals).lower()
            if 'caixa' in text or 'disponibilidade' in text:
                print(f"[{n}] Row {r}: {' | '.join(row_vals[:3])}")
