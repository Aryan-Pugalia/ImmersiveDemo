import type { SegmentationResult } from "@/types/segmentation";

export const SAMPLE_ANALYSIS_RESULTS: Record<string, SegmentationResult> = {
  "/samples/lung-tumor-xray.jpg": {
    imageType: "Chest X-Ray",
    summary:
      "Posteroanterior chest radiograph demonstrates a spiculated mass in the right upper lobe consistent with primary lung carcinoma. Right hilar enlargement suggests ipsilateral lymph node involvement. Left lung fields appear clear with no pleural effusion.",
    regions: [
      {
        name: "Primary Lung Mass",
        description:
          "Spiculated 3.2 cm opacity in the right upper lobe with irregular margins, highly suspicious for non-small cell lung carcinoma (NSCLC).",
        confidence: 0.92,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.54, y: 0.12, width: 0.2, height: 0.19 },
      },
      {
        name: "Right Hilar Lymphadenopathy",
        description:
          "Enlarged right hilar lymph nodes indicating possible regional nodal metastasis (N1 disease). Further PET-CT recommended.",
        confidence: 0.76,
        color: "#f59e0b",
        shape: "ellipse",
        bounds: { x: 0.52, y: 0.38, width: 0.14, height: 0.13 },
      },
      {
        name: "Left Lung Field",
        description:
          "Left lung appears well-aerated with no focal consolidation, pleural effusion, or pneumothorax. Cardiac silhouette normal.",
        confidence: 0.97,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.06, y: 0.1, width: 0.4, height: 0.74 },
      },
    ],
  },

  "/samples/brain-tumor-mri.jpg": {
    imageType: "Brain MRI",
    summary:
      "T1-weighted axial MRI with contrast reveals a heterogeneously enhancing mass in the right temporal-parietal region consistent with high-grade glioma (WHO Grade IV). Significant surrounding vasogenic edema with 6 mm midline shift to the left.",
    regions: [
      {
        name: "Glioblastoma Multiforme",
        description:
          "Heterogeneously enhancing mass measuring approximately 4.5 × 3.8 cm with central necrosis and irregular enhancing rim, consistent with GBM (WHO Grade IV).",
        confidence: 0.95,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.52, y: 0.28, width: 0.3, height: 0.28 },
      },
      {
        name: "Perilesional Vasogenic Edema",
        description:
          "Extensive T2/FLAIR hyperintensity surrounding the mass representing vasogenic edema causing mass effect on adjacent sulci and gyri.",
        confidence: 0.88,
        color: "#f59e0b",
        shape: "ellipse",
        bounds: { x: 0.42, y: 0.18, width: 0.5, height: 0.48 },
      },
      {
        name: "Midline Shift",
        description:
          "Approximately 6 mm leftward shift of the midline structures due to mass effect from the tumor and surrounding edema.",
        confidence: 0.83,
        color: "#a855f7",
        shape: "rect",
        bounds: { x: 0.44, y: 0.1, width: 0.08, height: 0.8 },
      },
      {
        name: "Contralateral Hemisphere",
        description:
          "Left cerebral hemisphere appears intact with preserved cortical thickness and no evidence of leptomeningeal spread or secondary lesions.",
        confidence: 0.96,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.05, y: 0.1, width: 0.38, height: 0.8 },
      },
    ],
  },

  "/samples/liver-tumor-ct.jpg": {
    imageType: "Liver CT (Contrast-Enhanced)",
    summary:
      "Contrast-enhanced CT of the abdomen reveals a hypervascular hepatic lesion in segment VI/VII of the right lobe, demonstrating arterial enhancement with washout on portal venous phase — findings consistent with hepatocellular carcinoma (HCC). No ascites or portal vein thrombosis identified.",
    regions: [
      {
        name: "Hepatic Lesion (HCC)",
        description:
          "3.8 cm hypervascular mass in hepatic segment VI/VII showing arterial phase enhancement and portal venous washout with pseudocapsule — LI-RADS 5, highly suspicious for HCC.",
        confidence: 0.91,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.55, y: 0.32, width: 0.24, height: 0.22 },
      },
      {
        name: "Normal Hepatic Parenchyma",
        description:
          "Remaining liver parenchyma shows homogeneous enhancement with no additional focal lesions. Liver margins are smooth with no morphological features of cirrhosis.",
        confidence: 0.94,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.18, y: 0.18, width: 0.64, height: 0.58 },
      },
      {
        name: "Portal Vein",
        description:
          "Main portal vein and its right and left branches are patent with no evidence of tumor thrombus or bland thrombus.",
        confidence: 0.85,
        color: "#3b82f6",
        shape: "rect",
        bounds: { x: 0.34, y: 0.44, width: 0.28, height: 0.1 },
      },
    ],
  },
};
