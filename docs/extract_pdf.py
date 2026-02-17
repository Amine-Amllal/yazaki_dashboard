import pdfplumber

with open(r'c:\Users\Idea\Documents\Projects Code\YazakiDashboard\docs\Cdc_text.txt', 'w', encoding='utf-8') as out:
    pdf = pdfplumber.open(r'c:\Users\Idea\Documents\Projects Code\YazakiDashboard\docs\Cdc.pdf')
    out.write(f'Total pages: {len(pdf.pages)}\n')
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if text:
            out.write(f'\n--- PAGE {i+1} ---\n')
            out.write(text + '\n')
        # Also try tables
        tables = page.extract_tables()
        if tables:
            for ti, table in enumerate(tables):
                out.write(f'\n[TABLE {ti+1} on page {i+1}]\n')
                for row in table:
                    out.write(' | '.join([str(c) if c else '' for c in row]) + '\n')
    pdf.close()
print('Done')
