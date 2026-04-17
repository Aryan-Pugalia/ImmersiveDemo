export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SegmentedRegion {
  name: string;
  description: string;
  confidence: number;
  color: string;
  bounds: RegionBounds;
  shape: "rect" | "ellipse";
}

export interface SegmentationResult {
  regions: SegmentedRegion[];
  summary: string;
  imageType: string;
}
