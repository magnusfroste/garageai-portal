import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { siteSettingsService } from "@/models/services/siteSettingsService";
import { SiteSettings } from "@/models/types/siteSettings.types";
import { toast } from "sonner";

export const useSiteSettings = () => {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => siteSettingsService.getSettings(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: SiteSettings) => siteSettingsService.saveSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, folder }: { file: File; folder: string }) =>
      siteSettingsService.uploadAsset(file, folder),
  });

  return {
    settings: settingsQuery.data,
    /** Stored values — use in editors that save. */
    rawSettings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    uploadAsset: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
  };
};
