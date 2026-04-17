// @ts-nocheck
export const useUploadDocument = () => ({ mutate: (v, opt) => opt?.onSuccess?.(), isPending: false });
export const useSubmitManualDocument = () => ({ mutate: (v, opt) => opt?.onSuccess?.(), isPending: false });
export const useListDocuments = () => ({ data: [], isLoading: false });
export const useDeleteDocument = () => ({ mutate: (v, opt) => opt?.onSuccess?.(), isPending: false });
export const getListDocumentsQueryKey = () => ["listDocuments"];
export const useGetDashboardSummary = () => ({ data: {}, isLoading: false });
export const getGetDashboardSummaryQueryKey = () => ["dashboardSummary"];
export const useGetDemoCases = () => ({ data: [], isLoading: false });
export const getGetDemoCasesQueryKey = () => ["demoCases"];
export const useGetAssociations = () => ({ data: {}, isLoading: false });
export const getGetAssociationsQueryKey = () => ["associations"];
