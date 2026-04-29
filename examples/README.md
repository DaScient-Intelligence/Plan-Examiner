# Plan-Examiner Examples

This folder contains synthetic sample plan documents (no PII) that you can use to test the Plan-Examiner review engine.

## Files

| File | Format | Project Type | Expected Findings |
|---|---|---|---|
| `sample-commercial-ti.txt` | Plain text (rename to .docx or paste content) | Commercial Tenant Improvement | ADA turning space, egress width |
| `sample-residential.txt` | Plain text | Residential Addition | Stair tread depth, plumbing |

## How to Use

1. Open [Plan-Examiner](https://dascient.github.io/Plan-Examiner)
2. Fill in the Project Details form (Building Type, Code, City, State, Country)
3. Upload one of the sample files
4. Click **Analyze Plan**

## Creating Your Own Test Files

For DXF testing:
- Use any CAD application to export as DXF (ASCII format)
- Include layers named: `WALL`, `DOOR`, `STAIR`, `EGRESS`, `ADA`
- Add dimension annotations and room labels

For PDF testing:
- Any searchable PDF with architectural content works
- Scanned (image-only) PDFs will have limited fact extraction

For DOCX testing:
- Create a Word document describing a project: occupancy type, square footage, number of exits, corridor widths, stair dimensions
