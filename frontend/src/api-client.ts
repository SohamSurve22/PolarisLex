import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api";

export const getListDocumentsQueryKey = (params: { userId?: string }) => ["documents", params];

export const useListDocuments = (params: { userId?: string }) => {
  return useQuery({
    queryKey: getListDocumentsQueryKey(params),
    queryFn: async () => {
      const url = new URL(`${window.location.origin}${API_BASE}/documents`);
      if (params.userId) url.searchParams.append("userId", params.userId);
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error("Failed to fetch documents");
      return resp.json();
    },
  });
};

export const useUploadDocument = () => {
  return useMutation({
    mutationFn: async ({ data }: { data: FormData }) => {
      const resp = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: data,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      return resp.json();
    },
  });
};

export const useSubmitManualDocument = () => {
  return useMutation({
    mutationFn: async ({ data }: { data: any }) => {
      const resp = await fetch(`${API_BASE}/documents/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Manual submission failed");
      }
      return resp.json();
    },
  });
};

export const useDeleteDocument = () => {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const resp = await fetch(`${API_BASE}/documents/${id}`, {
        method: "DELETE",
      });
      if (!resp.ok) throw new Error("Delete failed");
      return true;
    },
  });
};

export const useGetDashboardSummary = () => {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/dashboard/summary`);
      if (!resp.ok) throw new Error("Failed to fetch dashboard summary");
      return resp.json();
    },
  });
};

export const getGetDashboardSummaryQueryKey = () => ["dashboard-summary"];

export const useGetAssociations = (params: { userId?: string }) => {
  return useQuery({
    queryKey: ["associations", params],
    queryFn: async () => {
      const url = new URL(`${window.location.origin}${API_BASE}/associations`);
      if (params.userId) url.searchParams.append("userId", params.userId);
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error("Failed to fetch associations");
      return resp.json();
    },
  });
};

export const getGetAssociationsQueryKey = (params: { userId?: string }) => ["associations", params];

export const getGetDemoCasesQueryKey = () => ["demoCases"];

export const useGetDemoCases = (options?: any) => {
  return useQuery({
    queryKey: getGetDemoCasesQueryKey(),
    queryFn: async () => {
      // Returning mock demo cases for the demo page
      return [
        {
          id: "demo-1",
          title: "Compliant Driver",
          description: "All documents present and valid. Meets all compliance requirements.",
          expectedStatus: "compliant",
          scenario: "Standard verification process with valid DL and RC.",
          documentType: "DL"
        },
        {
          id: "demo-2",
          title: "Expired License",
          description: "Driver's license is past its expiration date.",
          expectedStatus: "flagged",
          scenario: "Evaluation of an expired document.",
          documentType: "DL"
        },
        {
          id: "demo-3",
          title: "Missing Insurance",
          description: "User is missing their insurance certificate.",
          expectedStatus: "review_required",
          scenario: "Missing document check across the profile.",
          documentType: "RC"
        },
        {
          id: "demo-4",
          title: "Name Mismatch",
          description: "Driver's name on DL does not match RC.",
          expectedStatus: "flagged",
          scenario: "Cross-document association check for discrepancies.",
          documentType: "DL"
        }
      ];
    },
    ...options?.query
  });
};
