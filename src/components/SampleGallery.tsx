import { motion } from "framer-motion";

interface SampleGalleryProps {
  onSampleSelected: (url: string, name: string) => void;
}

const SAMPLES = [
  // ── Local samples ─────────────────────────────────────────────────────────
  {
    name: "Lung Tumor X-Ray",
    description: "Chest radiograph with spiculated right upper lobe mass",
    url: "/samples/lung-tumor-xray.jpg",
  },
  {
    name: "Brain Tumor MRI",
    description: "Axial MRI with glioblastoma and midline shift",
    url: "/samples/brain-tumor-mri.jpg",
  },
  {
    name: "Liver CT Scan",
    description: "Contrast-enhanced CT with hepatocellular carcinoma",
    url: "/samples/liver-tumor-ct.jpg",
  },
  {
    name: "Cerebral Metastases MRI",
    description: "T1-contrast MRI with multiple ring-enhancing lesions",
    url: "/samples/brain-mri.jpg",
  },
  {
    name: "Pleural Mass Chest X-Ray",
    description: "PA chest radiograph with right pleural-based mass",
    url: "/samples/chest-xray.jpg",
  },
  {
    name: "Retinal Choroidal Lesion",
    description: "Fundus imaging with posterior pole choroidal tumour",
    url: "/samples/retinal-scan.jpg",
  },
  // ── NIH OpenI (Indiana University CXR — public domain) ────────────────────
  {
    name: "Pulmonary Nodule X-Ray",
    description: "Solitary 1.8 cm right lower lobe pulmonary nodule",
    url: "https://openi.nlm.nih.gov/imgs/512/CXR100_IM-0019-1001.png",
  },
  {
    name: "Right Lung Mass X-Ray",
    description: "Large right perihilar mass with ipsilateral effusion",
    url: "https://openi.nlm.nih.gov/imgs/512/CXR200_IM-0547-1001.png",
  },
  {
    name: "Hilar Adenopathy X-Ray",
    description: "Bilateral hilar enlargement consistent with mediastinal involvement",
    url: "https://openi.nlm.nih.gov/imgs/512/CXR300_IM-1003-1001.png",
  },
];

export function SampleGallery({ onSampleSelected }: SampleGalleryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {SAMPLES.map((sample) => (
          <button
            key={sample.name}
            onClick={() => onSampleSelected(sample.url, sample.name)}
            className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all hover:shadow-lg"
          >
            <div className="aspect-square bg-muted">
              <img
                src={sample.url}
                alt={sample.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <div className="dark-surface absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-3">
              <p className="text-sm font-semibold text-white">{sample.name}</p>
              <p className="text-sm text-white/70">{sample.description}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
