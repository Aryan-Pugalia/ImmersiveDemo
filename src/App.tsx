import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import UseCaseSelection from "./pages/UseCaseSelection.tsx";
import UseCaseDetail from "./pages/UseCaseDetail.tsx";
import LidarAnnotationTest from "./pages/LidarAnnotationTest.tsx";
import MedicalAnnotation from "./pages/MedicalAnnotation.tsx";
import ImageABTesting from "./pages/ImageABTesting.tsx";
import VideoABTesting from "./pages/VideoABTesting.tsx";
import InvoiceLabelerLayout from "./pages/InvoiceLabelerLayout.tsx";
import InvoiceDashboard from "./pages/invoice/InvoiceDashboard.tsx";
import InvoiceAnnotateWorkspace from "./pages/invoice/InvoiceAnnotateWorkspace.tsx";
import InvoiceReviewExport from "./pages/invoice/InvoiceReviewExport.tsx";
import QAReport from "./pages/QAReport.tsx";
import NotFound from "./pages/NotFound.tsx";
import AudioAnnotation from "./pages/AudioAnnotation.tsx";
import AudioAnnotationTest from "./pages/AudioAnnotationTest.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import ImpersonationRedaction from "./pages/ImpersonationRedaction.tsx";
import VideoObjectTracking from "./pages/VideoObjectTracking.tsx";
import IntelligentArchives from "./pages/IntelligentArchives.tsx";
import STEMReasoning from "./pages/STEMReasoning.tsx";
import PhysicsReasoning from "./pages/PhysicsReasoning.tsx";
import DriverMonitoring from "./pages/DriverMonitoring.tsx";
import AudioQualityQA from "./pages/AudioQualityQA.tsx";
import SpeechEmotionQA from "./pages/SpeechEmotionQA.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <LanguageProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/use-cases" element={<UseCaseSelection />} />
          <Route path="/use-cases/lidar-annotation" element={<LidarAnnotationTest />} />
          <Route path="/use-cases/medical-annotation" element={<MedicalAnnotation />} />
          <Route path="/use-cases/image-ab-testing" element={<ImageABTesting />} />
          <Route path="/use-cases/video-ab-testing" element={<VideoABTesting />} />
          <Route path="/use-cases/invoice-labeler" element={<InvoiceLabelerLayout />}>
            <Route index element={<InvoiceDashboard />} />
            <Route path="annotate/:id" element={<InvoiceAnnotateWorkspace />} />
            <Route path="review" element={<InvoiceReviewExport />} />
          </Route>
          <Route path="/use-cases/audio-annotation" element={<AudioAnnotationTest />} />
          <Route path="/use-cases/dating-trust-safety" element={<ImpersonationRedaction />} />
          <Route path="/use-cases/video-object-tracking" element={<VideoObjectTracking />} />
          <Route path="/use-cases/intelligent-archives" element={<IntelligentArchives />} />
          <Route path="/use-cases/stem-reasoning" element={<STEMReasoning />} />
          <Route path="/use-cases/physics-reasoning" element={<PhysicsReasoning />} />
          <Route path="/use-cases/driver-monitoring" element={<DriverMonitoring />} />
          <Route path="/use-cases/audio-quality-qa" element={<AudioQualityQA />} />
          <Route path="/use-cases/speech-emotion-qa" element={<SpeechEmotionQA />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/use-cases/:useCaseId" element={<UseCaseDetail />} />
          <Route path="/qa-report/:useCaseId" element={<QAReport />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
