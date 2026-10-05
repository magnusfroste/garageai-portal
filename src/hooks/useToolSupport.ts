import { useQuery } from "@tanstack/react-query";
import { catalogRepository } from "@/data/repositories/catalogRepository";
import { modelSupportsTools } from "@/models/services/toolSupportService";

export const useToolSupport = () => {
  const { data = [] } = useQuery({
    queryKey: ["garage-tool-support"],
    queryFn: () => catalogRepository.toolSupport(),
    staleTime: 5 * 60 * 1000,
  });
  return { rows: data, supportsTools: (modelId: string) => modelSupportsTools(data, modelId) };
};
