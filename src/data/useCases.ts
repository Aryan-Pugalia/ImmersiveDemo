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
    id: "2",
    slug: "ner",
    title: "Named Entity Recognition",
    description: "Extract structured information from unstructured text documents, identifying organizations, dates, and locations.",
    icon: "data_object",
    idTag: "NLP-042",
    categoryTag: "NLP",
    secondaryTag: "Batch",
  },
  {
    id: "3",
    slug: "semantic-segmentation",
    title: "Semantic Segmentation",
    description: "Pixel-level classification for autonomous driving and medical imaging where every pixel belongs to a specific class.",
    icon: "layers",
    idTag: "VIS-089",
    categoryTag: "Medical/Auto",
    secondaryTag: "High-Res",
  },
  {
    id: "4",
    slug: "audio-transcription",
    title: "Audio Transcription",
    description: "Convert spoken language into machine-readable text with multi-speaker diarization and timestamping.",
    icon: "mic",
    idTag: "AUD-012",
    categoryTag: "Audio",
    secondaryTag: "60+ Lang",
  },
  {
    id: "5",
    slug: "document-ocr",
    title: "Document OCR",
    description: "Extract text and structured data from scanned documents, invoices, and forms with high accuracy.",
    icon: "description",
    idTag: "DOC-772",
    categoryTag: "Document AI",
    secondaryTag: "Enterprise",
  },
];

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return useCases.find((uc) => uc.slug === slug);
}
