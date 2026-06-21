import { describe, expect, it } from "vitest";

import {
  applyVenuniteFreeAdmissionFields,
  isVenuniteFreeCostText,
  resolveVenunitePriceFields
} from "./venunite-price.utils";

describe("venunite-price.utils", () => {
  describe("isVenuniteFreeCostText", () => {
    it("recognizes free admission strings", () => {
      expect(isVenuniteFreeCostText("Free")).toBe(true);
      expect(isVenuniteFreeCostText("Free Entry")).toBe(true);
      expect(isVenuniteFreeCostText("$0")).toBe(true);
      expect(isVenuniteFreeCostText("$0 - $0")).toBe(true);
    });

    it("does not treat low-start paid ranges as free", () => {
      expect(isVenuniteFreeCostText("$0-$20")).toBe(false);
      expect(isVenuniteFreeCostText("$15")).toBe(false);
    });
  });

  describe("resolveVenunitePriceFields", () => {
    it("marks free from cost text", () => {
      expect(resolveVenunitePriceFields(null, "Free")).toEqual({
        isFree: true,
        priceMin: 0,
        priceMax: 0,
        priceNotes: "Free",
        currency: "USD"
      });
    });

    it("marks free from zero-cent priceWatch", () => {
      expect(
        resolveVenunitePriceFields({ minPriceCents: 0, maxPriceCents: 0, currency: "USD" }, null)
      ).toEqual({
        isFree: true,
        priceMin: 0,
        priceMax: 0,
        currency: "USD"
      });
    });

    it("maps paid cents without isFree", () => {
      expect(
        resolveVenunitePriceFields({ minPriceCents: 2000, maxPriceCents: 2000, currency: "USD" }, "$20")
      ).toEqual({
        priceMin: 20,
        priceMax: 20,
        currency: "USD"
      });
    });
  });

  describe("applyVenuniteFreeAdmissionFields", () => {
    it("backfills isFree from Cost: Free description stub", () => {
      expect(
        applyVenuniteFreeAdmissionFields({
          descriptionText: "Cost: Free",
          isFree: undefined,
          priceMin: undefined,
          priceMax: undefined
        })
      ).toEqual({ isFree: true, priceMin: 0, priceMax: 0 });
    });

    it("leaves paid events unchanged", () => {
      expect(
        applyVenuniteFreeAdmissionFields({
          descriptionText: "Cost: $20",
          isFree: undefined,
          priceMin: 20,
          priceMax: 20
        })
      ).toEqual({});
    });
  });
});
