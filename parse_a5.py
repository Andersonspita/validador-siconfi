import xlrd

wb = xlrd.open_workbook('decrypted.xls')
print("Sheets:", wb.sheet_names())
for n in wb.sheet_names():
    if 'Anexo 05' in n or 'Anexo 5' in n:
        sheet = wb.sheet_by_name(n)
        for r in range(sheet.nrows):
            row_vals = [str(x) for x in sheet.row_values(r)]
            text = ' '.join(row_vals).lower()
            if 'caixa' in text or 'disponibilidade' in text:
                print(f"[{n}] Row {r}: {' | '.join(row_vals[:3])}")
