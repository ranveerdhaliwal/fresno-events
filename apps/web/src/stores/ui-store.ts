import { create } from "zustand";

type Appearance = "system" | "light" | "dark";

interface UiState {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

export const useUiStore = create<UiState>((set) => ({
  appearance: "system",
  setAppearance: (appearance) => set({ appearance })
}));
