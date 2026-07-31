package com.hms.service;

import com.hms.web.ApiException;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Shared CSV / Excel / PDF exporters for tabular hotel reports. */
@Component
public class ReportExportHelper {

    public byte[] toCsv(List<String> headers, List<List<String>> rows) {
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", headers.stream().map(this::csvEscape).toList())).append('\n');
        for (List<String> row : rows) {
            csv.append(String.join(",", row.stream().map(this::csvEscape).toList())).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] toXlsx(String sheetName, List<String> headers, List<List<String>> rows) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(sheetName == null || sheetName.isBlank() ? "Report" : sheetName);
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
            }
            for (int r = 0; r < rows.size(); r++) {
                Row row = sheet.createRow(r + 1);
                List<String> values = rows.get(r);
                for (int c = 0; c < values.size(); c++) {
                    row.createCell(c).setCellValue(values.get(c) == null ? "" : values.get(c));
                }
            }
            for (int i = 0; i < headers.size(); i++) {
                sheet.autoSizeColumn(i);
            }
            workbook.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate Excel report");
        }
    }

    public byte[] toPdf(String title, String subtitle, List<String> headers, List<List<String>> rows) {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            var regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream content = new PDPageContentStream(doc, page);
            float y = 800;
            content.beginText();
            content.setFont(bold, 14);
            content.newLineAtOffset(40, y);
            content.showText(sanitize(title));
            content.endText();
            y -= 18;
            if (subtitle != null && !subtitle.isBlank()) {
                content.beginText();
                content.setFont(regular, 10);
                content.newLineAtOffset(40, y);
                content.showText(sanitize(subtitle));
                content.endText();
                y -= 16;
            }
            content.beginText();
            content.setFont(bold, 8);
            content.newLineAtOffset(40, y);
            content.showText(sanitize(String.join(" | ", headers)));
            content.endText();
            y -= 12;
            int printed = 0;
            for (List<String> row : rows) {
                if (y < 40) {
                    content.close();
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    content = new PDPageContentStream(doc, page);
                    y = 800;
                }
                content.beginText();
                content.setFont(regular, 8);
                content.newLineAtOffset(40, y);
                content.showText(sanitize(String.join(" | ", row)));
                content.endText();
                y -= 11;
                printed++;
                if (printed > 2000) {
                    break;
                }
            }
            content.close();
            doc.save(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate PDF report");
        }
    }

    private String csvEscape(String value) {
        String v = value == null ? "" : value;
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private static String sanitize(String text) {
        if (text == null) {
            return "";
        }
        // PDF Type1 fonts are WinAnsi — strip unsupported characters.
        return text.replaceAll("[^\\x20-\\x7E]", "?");
    }
}
