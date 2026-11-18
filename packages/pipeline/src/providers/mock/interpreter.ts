import { cloneSpec, type AttributeSpec } from "@fishbelly/core";
import type { PromptInterpreter } from "../types";

const COLOURS: Record<string, string> = {
  white: "#f4f1ea",
  black: "#2b2b2b",
  blue: "#3b6ea5",
  green: "#5d8a66",
  terracotta: "#c2694a",
  pink: "#e3a5b0",
  yellow: "#e0b94a",
  grey: "#9a9a9a",
  gray: "#9a9a9a",
  red: "#b5413b",
  sand: "#d9d2c5",
};

/**
 * Keyword-based stand-in for the LLM. Deliberately naive: it will happily propose
 * changing locked dimensions or adding handles, which is exactly what a real model
 * might do, so the constraint layer gets exercised.
 */
export const mockInterpreter: PromptInterpreter = {
  name: "mock-interpreter",
  async interpret({ prompt, current, template }) {
    const text = prompt.toLowerCase();
    const proposed = cloneSpec(current);
    const notes: string[] = [];
    let changed = false;
    const bump = (attr: AttributeSpec, by: number) => {
      attr.intensity = Math.round((attr.intensity + by) * 100) / 100;
    };

    if (/\bbase\b/.test(text) && /narrow|wide|small|bigg|larg|slim|thin/.test(text)) {
      const base = template.dimensions.base_diameter;
      if (base?.kind === "locked") proposed.dimensions.base_diameter = base.value * 0.6;
      changed = true;
    }
    if (/handle/.test(text)) {
      proposed.attributes.handles = { description: "handles", intensity: 0.5 };
      changed = true;
    }

    const exact = text.match(/(\d{2,3})\s*mm/);
    const height = proposed.dimensions.height ?? 200;
    if (exact && /tall|high|height/.test(text)) {
      proposed.dimensions.height = Number(exact[1]);
      changed = true;
    } else if (/taller|higher/.test(text)) {
      proposed.dimensions.height = height + 30;
      changed = true;
    } else if (/shorter|lower/.test(text)) {
      proposed.dimensions.height = height - 30;
      changed = true;
    }

    const stronger = /deep|more|bold|strong|dramatic/.test(text);
    const softer = /subtle|less|reduce|soft|smooth/.test(text);

    if (/groove|ridge|rib|texture|wave|ocean|ripple|detail|pattern/.test(text)) {
      const tex = proposed.attributes.surface_texture ?? { description: "smooth", intensity: 0.25 };
      if (/groove|ridge|rib/.test(text)) tex.description = "vertical grooves";
      if (/wave|ocean|ripple/.test(text)) tex.description = "flowing wave ripples";
      // "more subtle" contains "more", so softer wins when both match.
      bump(tex, softer ? -0.25 : stronger ? 0.25 : tex.intensity < 0.5 ? 0.25 : 0);
      proposed.attributes.surface_texture = tex;
      changed = true;
    }
    if (/organic|asymmetr|curv|flow|shape|silhouette|symmetric|straight/.test(text)) {
      const sil = proposed.attributes.silhouette ?? { description: "classic", intensity: 0.2 };
      if (/symmetric|straight/.test(text) && !/asymmetr/.test(text)) {
        sil.description = "clean and symmetric";
        bump(sil, -0.3);
      } else {
        sil.description = "organic, slightly asymmetric";
        bump(sil, softer ? -0.25 : 0.3);
      }
      proposed.attributes.silhouette = sil;
      changed = true;
    }
    for (const [word, hex] of Object.entries(COLOURS)) {
      if (new RegExp(`\\b${word}\\b`).test(text)) {
        proposed.colour = hex;
        changed = true;
      }
    }

    if (changed) proposed.summary = prompt.trim();
    else notes.push("I wasn't sure what to change. Try describing the texture, shape, height or colour.");
    return { proposed, notes, costUsd: 0 };
  },
};
