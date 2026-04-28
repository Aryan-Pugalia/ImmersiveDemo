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

  // ── New samples ──────────────────────────────────────────────────────────────

  "/samples/brain-mri.jpg": {
    imageType: "Brain MRI (Contrast)",
    summary:
      "Gadolinium-enhanced T1 MRI demonstrates multiple ring-enhancing lesions scattered throughout both cerebral hemispheres, consistent with cerebral metastatic disease. The largest lesion in the left frontal lobe measures 2.1 cm with surrounding oedema and mild mass effect.",
    regions: [
      {
        name: "Dominant Left Frontal Metastasis",
        description:
          "2.1 cm ring-enhancing lesion in the left frontal lobe with central necrosis and surrounding T2/FLAIR oedema — consistent with metastatic deposit.",
        confidence: 0.94,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.18, y: 0.22, width: 0.22, height: 0.2 },
      },
      {
        name: "Right Parietal Metastasis",
        description:
          "1.4 cm enhancing nodule in the right parietal cortex consistent with a secondary metastatic lesion. Minimal surrounding oedema.",
        confidence: 0.87,
        color: "#f97316",
        shape: "ellipse",
        bounds: { x: 0.62, y: 0.18, width: 0.16, height: 0.14 },
      },
      {
        name: "Left Cerebellar Lesion",
        description:
          "0.8 cm enhancing focus in the left cerebellar hemisphere. Although small, location raises concern for posterior fossa metastasis.",
        confidence: 0.72,
        color: "#f59e0b",
        shape: "ellipse",
        bounds: { x: 0.3, y: 0.72, width: 0.12, height: 0.1 },
      },
      {
        name: "Perilesional Oedema",
        description:
          "Confluent T2 signal abnormality surrounds the dominant left frontal lesion, exerting mild mass effect on the adjacent lateral ventricle.",
        confidence: 0.89,
        color: "#a855f7",
        shape: "ellipse",
        bounds: { x: 0.1, y: 0.14, width: 0.36, height: 0.34 },
      },
    ],
  },

  "/samples/chest-xray.jpg": {
    imageType: "Chest X-Ray",
    summary:
      "PA chest radiograph reveals a lobulated right pleural-based mass measuring approximately 6 cm, consistent with pleural mesothelioma or metastatic pleural disease. Moderate right-sided pleural effusion is present. The left lung field is clear.",
    regions: [
      {
        name: "Pleural-Based Mass",
        description:
          "Large lobulated opacity along the right lateral chest wall measuring ~6 cm, with obtuse angles to the pleural surface — pleural origin confirmed. Biopsy recommended.",
        confidence: 0.89,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.6, y: 0.25, width: 0.28, height: 0.35 },
      },
      {
        name: "Right Pleural Effusion",
        description:
          "Moderate layering right-sided pleural effusion blunting the right costophrenic angle, likely reactive to the adjacent pleural mass.",
        confidence: 0.93,
        color: "#3b82f6",
        shape: "ellipse",
        bounds: { x: 0.54, y: 0.62, width: 0.38, height: 0.25 },
      },
      {
        name: "Left Lung Field",
        description:
          "Left lung is clear with no focal consolidation, effusion, or pneumothorax. Cardiac contour within normal limits.",
        confidence: 0.97,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.06, y: 0.12, width: 0.42, height: 0.72 },
      },
    ],
  },

  "/samples/retinal-scan.jpg": {
    imageType: "Fundus / Retinal Imaging",
    summary:
      "Colour fundus photograph reveals a pigmented choroidal lesion located in the superotemporal quadrant of the posterior pole. The lesion measures approximately 4 disc diameters with associated subretinal fluid and orange lipofuscin pigment — features raising concern for choroidal melanoma.",
    regions: [
      {
        name: "Choroidal Melanoma",
        description:
          "4 DD pigmented elevated lesion in the superotemporal fundus with basal diameter ~12 mm. Orange surface pigment (lipofuscin) and subretinal fluid are high-risk features.",
        confidence: 0.88,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.52, y: 0.22, width: 0.26, height: 0.22 },
      },
      {
        name: "Subretinal Fluid",
        description:
          "Inferiorly shifted subretinal fluid extending towards the macula from the base of the lesion, indicating active exudation and risk to central vision.",
        confidence: 0.81,
        color: "#f59e0b",
        shape: "ellipse",
        bounds: { x: 0.38, y: 0.38, width: 0.3, height: 0.22 },
      },
      {
        name: "Optic Disc",
        description:
          "Optic disc appears normal in size and colour. No disc oedema or neovascularisation identified. Tumour margin is 3 mm from the disc.",
        confidence: 0.96,
        color: "#22c55e",
        shape: "ellipse",
        bounds: { x: 0.28, y: 0.42, width: 0.1, height: 0.1 },
      },
    ],
  },

  // ── NIH OpenI chest X-rays ────────────────────────────────────────────────

  "/samples/chest-nodule-xray.png": {
    imageType: "Chest X-Ray",
    summary:
      "PA chest radiograph demonstrates a solitary pulmonary nodule in the right lower lobe measuring 1.8 cm. Smooth borders and moderate density suggest a benign aetiology; however, given size, CT correlation and PET scan are recommended to exclude early-stage lung malignancy.",
    regions: [
      {
        name: "Solitary Pulmonary Nodule",
        description:
          "1.8 cm well-circumscribed nodule in the right lower lobe (posterior segment). Smooth border is reassuring but size mandates CT follow-up per Fleischner guidelines.",
        confidence: 0.84,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.56, y: 0.56, width: 0.16, height: 0.14 },
      },
      {
        name: "Right Lung Field",
        description:
          "Remainder of the right lung shows normal aeration. No consolidation, effusion, or additional nodules identified on this view.",
        confidence: 0.91,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.5, y: 0.1, width: 0.44, height: 0.78 },
      },
      {
        name: "Left Lung Field",
        description:
          "Left lung is clear. Cardiac silhouette and mediastinal contour within normal limits. Diaphragm well-defined bilaterally.",
        confidence: 0.95,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.06, y: 0.1, width: 0.42, height: 0.78 },
      },
    ],
  },

  "/samples/chest-perihilar-xray.png": {
    imageType: "Chest X-Ray",
    summary:
      "PA chest radiograph shows a large perihilar mass in the right lung with associated right-sided pleural effusion. The mass demonstrates lobulated margins and causes rightward tracheal deviation. Findings are highly suspicious for centrally arising lung carcinoma with regional spread.",
    regions: [
      {
        name: "Right Perihilar Mass",
        description:
          "Large lobulated mass centred on the right hilum measuring approximately 7 × 5 cm. Causing partial collapse of the right middle lobe — consistent with central bronchogenic carcinoma.",
        confidence: 0.93,
        color: "#ef4444",
        shape: "ellipse",
        bounds: { x: 0.5, y: 0.22, width: 0.34, height: 0.32 },
      },
      {
        name: "Right Pleural Effusion",
        description:
          "Moderate right-sided pleural effusion blunting the costophrenic angle, likely secondary to lymphatic obstruction from the hilar mass.",
        confidence: 0.9,
        color: "#3b82f6",
        shape: "ellipse",
        bounds: { x: 0.54, y: 0.64, width: 0.36, height: 0.24 },
      },
      {
        name: "Mediastinal Shift",
        description:
          "Mild rightward tracheal deviation related to volume loss in the right middle lobe from central airway compression by the mass.",
        confidence: 0.78,
        color: "#a855f7",
        shape: "rect",
        bounds: { x: 0.44, y: 0.08, width: 0.06, height: 0.5 },
      },
    ],
  },

  "/samples/chest-hilar-xray.png": {
    imageType: "Chest X-Ray",
    summary:
      "PA chest radiograph demonstrates bilateral hilar lymph node enlargement with a right paratracheal soft tissue mass, raising concern for mediastinal lymphoma or sarcoidosis with malignant transformation. No pulmonary consolidation. Clinical correlation with serum LDH, beta-2 microglobulin and CT-chest recommended.",
    regions: [
      {
        name: "Right Paratracheal Mass",
        description:
          "Soft tissue density in the right paratracheal region measuring ~4 cm, widening the superior mediastinum. Differential includes lymphoma, sarcoidosis, or metastatic adenopathy.",
        confidence: 0.87,
        color: "#ef4444",
        shape: "rect",
        bounds: { x: 0.5, y: 0.08, width: 0.2, height: 0.22 },
      },
      {
        name: "Right Hilar Adenopathy",
        description:
          "Enlarged right hilar lymph nodes producing the classic 'Pawn-broker sign' — bilateral symmetric hilar prominence characteristic of lymphoma or sarcoidosis.",
        confidence: 0.85,
        color: "#f59e0b",
        shape: "ellipse",
        bounds: { x: 0.54, y: 0.34, width: 0.16, height: 0.14 },
      },
      {
        name: "Left Hilar Adenopathy",
        description:
          "Left hilar enlargement mirrors the right, completing the bilateral symmetric pattern. Left lung fields otherwise clear with no effusion.",
        confidence: 0.82,
        color: "#f97316",
        shape: "ellipse",
        bounds: { x: 0.3, y: 0.34, width: 0.16, height: 0.14 },
      },
      {
        name: "Lung Parenchyma",
        description:
          "Both lung fields show normal aeration with no focal consolidation or effusion. No endobronchial lesion identified on plain film.",
        confidence: 0.94,
        color: "#22c55e",
        shape: "rect",
        bounds: { x: 0.06, y: 0.1, width: 0.86, height: 0.76 },
      },
    ],
  },
};
