import React, { createContext, useContext, useState, useCallback } from "react";
import { InvoiceDocument, Annotation, DocumentStatus } from "@/types/invoice-annotation";
import { mockDocuments } from "@/data/invoice-mock-documents";

interface InvoiceAnnotationContextType {
  documents: InvoiceDocument[];
  addAnnotation: (docId: string, annotation: Annotation) => void;
  updateAnnotation: (docId: string, annotationId: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (docId: string, annotationId: string) => void;
  setDocumentStatus: (docId: string, status: DocumentStatus) => void;
  getDocument: (docId: string) => InvoiceDocument | undefined;
}

const InvoiceAnnotationContext = createContext<InvoiceAnnotationContextType | null>(null);

export function InvoiceAnnotationProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<InvoiceDocument[]>(mockDocuments);

  const addAnnotation = useCallback((docId: string, annotation: Annotation) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? { ...doc, annotations: [...doc.annotations, annotation], status: "in_progress" as DocumentStatus }
          : doc
      )
    );
  }, []);

  const updateAnnotation = useCallback((docId: string, annotationId: string, updates: Partial<Annotation>) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              annotations: doc.annotations.map((a) => (a.id === annotationId ? { ...a, ...updates } : a)),
            }
          : doc
      )
    );
  }, []);

  const deleteAnnotation = useCallback((docId: string, annotationId: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? { ...doc, annotations: doc.annotations.filter((a) => a.id !== annotationId) }
          : doc
      )
    );
  }, []);

  const setDocumentStatus = useCallback((docId: string, status: DocumentStatus) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, status } : doc)));
  }, []);

  const getDocument = useCallback((docId: string) => documents.find((d) => d.id === docId), [documents]);

  return (
    <InvoiceAnnotationContext.Provider value={{ documents, addAnnotation, updateAnnotation, deleteAnnotation, setDocumentStatus, getDocument }}>
      {children}
    </InvoiceAnnotationContext.Provider>
  );
}

export function useInvoiceAnnotation() {
  const ctx = useContext(InvoiceAnnotationContext);
  if (!ctx) throw new Error("useInvoiceAnnotation must be used within InvoiceAnnotationProvider");
  return ctx;
}
