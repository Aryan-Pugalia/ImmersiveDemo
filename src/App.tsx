import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import UseCaseSelection from "./pages/UseCaseSelection.tsx";
import UseCaseDetail from "./pages/UseCaseDetail.tsx";
import LidarAnnotation from "./pages/LidarAnnotation.tsx";
import MedicalAnnotation from "./pages/MedicalAnnotation.tsx";
import InvoiceLabelerLayout from "./pages/InvoiceLabelerLayout.tsx";
import InvoiceDashboard from "./pages/invoice/InvoiceDashboard.tsx";
import InvoiceAnnotateWorkspace from "./pages/invoice/InvoiceAnnotateWorkspace.tsx";
import InvoiceReviewExport from "./pages/invoice/InvoiceReviewExport.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/use-cases" element={<UseCaseSelection />} />
          <Route path="/use-cases/lidar-annotation" element={<LidarAnnotation />} />
          <Route path="/use-cases/medical-annotation" element={<MedicalAnnotation />} />
          <Route path="/use-cases/invoice-labeler" element={<InvoiceLabelerLayout />}>
            <Route index element={<InvoiceDashboard />} />
            <Route path="annotate/:id" element={<InvoiceAnnotateWorkspace />} />
            <Route path="review" element={<InvoiceReviewExport />} />
          </Route>
          <Route path="/use-cases/:useCaseId" element={<UseCaseDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
