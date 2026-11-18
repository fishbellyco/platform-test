export interface Brand {
  id: string;
  name: string;
  /** The only origin allowed to host the embed and receive its messages. */
  allowedOrigin: string;
  templateIds: string[];
  theme: { accent: string };
}

// Placeholder tenant for local development. Moves to the database with real brands.
const BRANDS: Record<string, Brand> = {
  demo: {
    id: "demo",
    name: "Demo Brand",
    allowedOrigin: "http://localhost:3000",
    templateIds: ["vase_001"],
    theme: { accent: "#1f3a5f" },
  },
};

export function getBrand(id: string): Brand | null {
  return BRANDS[id] ?? null;
}
