import { motion } from "framer-motion";

interface SampleGalleryProps {
  onSampleSelected: (url: string, name: string) => void;
}

const SAMPLES = [
  {
    name: "Lung Tumor X-Ray",
    description: "Chest radiograph with visible lung mass",
    url: "/samples/lung-tumor-xray.jpg",
  },
  {
    name: "Brain Tumor MRI",
    description: "Axial MRI with glioblastoma",
    url: "/samples/brain-tumor-mri.jpg",
  },
  {
    name: "Liver CT Scan",
    description: "Contrast-enhanced CT with hepatic lesion",
    url: "/samples/liver-tumor-ct.jpg",
  },
  {
    name: "Chest X-Ray",
    description: "Posteroanterior chest radiograph",
    url: "/samples/chest-xray.jpg",
  },
  {
    name: "Brain MRI",
    description: "T1-weighted axial brain scan",
    url: "/samples/brain-mri.jpg",
  },
  {
    name: "Retinal Scan",
    description: "Fundus photograph of the eye",
    url: "/samples/retinal-scan.jpg",
  },
];

export function SampleGallery({ onSampleSelected }: SampleGalleryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <p className="text-sm font-medium text-muted-foreground mb-3">
        Or try a sample image
      </p>
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
