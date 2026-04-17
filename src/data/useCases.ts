export interface UseCase {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  idTag: string;
  categoryTag: string;
  secondaryTag: string;
}

export const useCases: UseCase[] = [
  {
    id: "1",
    slug: "lidar-annotation",
    title: "LiDAR 3D Annotation",
    description: "Annotate 3D point clouds with bounding boxes for autonomous driving, robotics, and spatial analysis pipelines.",
    icon: "view_in_ar",
    idTag: "LID-001",
    categoryTag: "3D / Point Cloud",
    secondaryTag: "Autonomous",
  },
  {
    id: "6",
    slug: "medical-annotation",
    title: "Medical Image Annotation",
    description: "Annotate tumors, lesions, and regions of interest on medical scans — X-Ray, MRI, CT — with AI-assisted verification.",
    icon: "radiology",
    idTag: "MED-001",
    categoryTag: "Medical Imaging",
    secondaryTag: "AI-Assisted",
  },
  {
    id: "7",
    slug: "invoice-labeler",
    title: "Invoice Labeler",
    description: "Label and extract structured fields from invoices and receipts — vendor, totals, line items — with bounding-box annotation and JSON export.",
    icon: "receipt_long",
    idTag: "DOC-101",
    categoryTag: "Document AI",
    secondaryTag: "IDP",
  },
];

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return useCases.find((uc) => uc.slug === slug);
}
