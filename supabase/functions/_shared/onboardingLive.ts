/** Live once the register step is done: "register", or any counted "N/M  Register with GarageAI" label. */
export const isLiveStep = (step: string) => step === "register" || /^\d+\/\d+\s+Register with GarageAI$/.test(step.trim());
