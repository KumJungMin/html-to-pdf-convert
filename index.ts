import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// you can view more option in https://artskydj.github.io/jsPDF/docs/jsPDF.html
type JsPdfOption = {
  orientation?: "p" | "portrait" | "l" | "landscape";
  unit?: "pt" | "px" | "in" | "mm" | "cm" | "ex" | "em" | "pc";
  format?: string | number[];
  encryption?: {
    userPassword?: string;
    ownerPassword?: string;
    userPermissions?: string[];
  };
};

type BlobOption = {
  fileName: string;
};

interface IHtmlToPdf {
  elementId: string;
  jsPdfOption?: JsPdfOption;
  blobOption?: BlobOption;
}

export type PdfFile = {
  blob: Blob | null;
  formData: FormData | null;
  pdf: jsPDF | null;
};

const defaultBlobOption = { fileName: "sample.pdf" };
const defaultJsPdfOption: JsPdfOption = {
  orientation: "portrait",
  unit: "mm",
  format: "a4",
};

export function useHtmlToPdf(arg: IHtmlToPdf): {
  pdfFile: any;
  generatePDF: () => Promise<PdfFile | null>;
} {
  let pdfFile = <PdfFile | null>(null);

  /**
   * HTML 엘리먼트를 PDF로 변환합니다.
   * @returns 변환된 PDF 파일.
   * */
  async function generatePDF(): Promise<PdfFile | null> {
    const { elementId, blobOption = {}, jsPdfOption = {} } = arg;

    const newJsPdfOption = { ...defaultJsPdfOption, ...jsPdfOption };
    const element = document.getElementById(elementId);
    const pdf = await convertHtmlToPdf(element, newJsPdfOption);
    if (!pdf) return null;

    const blob = pdf.output("blob");
    const newBolbOption = { ...defaultBlobOption, ...blobOption };
    const formData = convertBolbToFormData(blob, [newBolbOption.fileName]);

    pdfFile = { blob, formData, pdf };
    return { blob, formData, pdf };
  }
  return { pdfFile, generatePDF };
}

/**
 * Bolb를 FormData로 변환합니다.
 * @param blob 변환할 Blob 객체.
 * @param blobOption blob에 대한 옵션.
 * @returns 변환된 FormData 객체.
 */
function convertBolbToFormData(blob: Blob, blobOption: string[]): FormData {
  const formData = new FormData();
  formData.append("file", blob, ...blobOption);
  return formData;
}

// TODO: add pagebreak config
function elPageBreakConfig (element: HTMLElement) {
  return [
    { el: element.querySelectorAll("table"), pagebreak: "page-fit" },
    { el: element.querySelectorAll("img"), pagebreak: "page-fit" },
  ];
};

function handlePdfClone(element: HTMLElement) {
  // TODO: 297을 상수로 빼기
  
  const a4Height = 297;
  elPageBreakConfig(element).forEach(({ el, pagebreak }) => {
    el.forEach((target) => {
      const targetRect = target.getBoundingClientRect();

      // TODO: fix topPosition calculation
      const topPosition = Math.max(
        0,
        targetRect.top - (targetRect.top % a4Height)
      );
      const bottomPosition = topPosition + targetRect.height;

      if (bottomPosition > a4Height) {
        if (pagebreak === "always") {
          target.style.marginTop = `${a4Height - topPosition}px`;
        } else if (pagebreak === "page-fit") {
          target.style.height = `${Math.min(
            Math.abs(a4Height - topPosition),
            a4Height
          )}px`;
        }
      }
    });
  });
};

/**
 * HTML 엘리먼트를 PDF로 변환합니다.
 * @param element 변환할 HTML 엘리먼트.
 * @param jsPdfOption PDF 변환 옵션.
 * @returns 변환된 PDF 객체.
 */
async function convertHtmlToPdf(
  element: HTMLElement | null,
  jsPdfOption: JsPdfOption
): Promise<jsPDF | null> {
  if (!element) return null;

  const canvas = await html2canvas(element, {
    /** image load를 위해 설정 */
    scale: 1,
    logging: true,
    useCORS: true,
    onclone: (_, element: HTMLElement) => handlePdfClone(element),
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.7);

  const pdf = new jsPDF(jsPdfOption);

  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "jpeg", 0, position, pdfWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "jpeg", 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
  }
  return pdf;
}