"use client";

import { useEffect } from "react";

/** Injected on quote/BEO print routes — hides staff shell, prints `.hms-print-document` only. */
export const HMS_PRINT_DOCUMENT_STYLES = `
@media print {
  @page {
    margin: 12mm;
    size: A4;
  }
  body[data-hms-print-document] {
    background: #fff !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  body[data-hms-print-document] * {
    visibility: hidden;
  }
  body[data-hms-print-document] .hms-print-document,
  body[data-hms-print-document] .hms-print-document * {
    visibility: visible;
  }
  body[data-hms-print-document] .hms-print-document {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    min-height: auto !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #fff !important;
  }
  body[data-hms-print-document] main,
  body[data-hms-print-document] main > div {
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    overflow: visible !important;
  }
  body[data-hms-print-document] .no-print {
    display: none !important;
    visibility: hidden !important;
  }
  .hms-print-avoid-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

export function useHmsPrintDocument() {
  useEffect(() => {
    document.body.setAttribute("data-hms-print-document", "true");
    return () => {
      document.body.removeAttribute("data-hms-print-document");
    };
  }, []);
}
