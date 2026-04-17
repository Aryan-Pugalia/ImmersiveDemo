export type TumorType =
  | "benign"
  | "malignant"
  | "metastatic"
  | "cystic"
  | "necrotic"
  | "calcified"
  | "unknown";

export type TumorStage =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "uncertain";

export type AnnotationCategory =
  | "tumor"
  | "lesion"
  | "anomaly"
  | "normal"
  | "other";

export interface Annotation {
  id: string;
  label: string;
  color: string;
  shape: "rect" | "ellipse";
  bounds: { x: number; y: number; width: number; height: number };
  notes: string;
  category: AnnotationCategory;
  tumorType?: TumorType;
  tumorStage?: TumorStage;
  confidence: number; // 0-100
  annotatorName?: string;
  createdAt: string;
}

export type DrawingTool = "rect" | "ellipse" | "select";
