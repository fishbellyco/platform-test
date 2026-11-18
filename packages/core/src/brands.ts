// Tenancy. A workspace is one client. Everything a client owns hangs off its workspace:
// its brands, the design sessions opened through those brands, and everything those
// sessions produce. Users see a workspace only if they are an admin or have been given access.

export interface Workspace {
  id: string;
  name: string;
}

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  /** The only origin allowed to host the embed and receive its messages. Null = not embeddable. */
  allowedOrigin: string | null;
  templateIds: string[];
  theme: { accent: string };
  /** Brand identity for the image model, placed before the product prompt. May be empty. */
  prompt: string;
  /** Text the product carries for this brand (the fisherman's fish). Null = this brand has none. */
  wordmark: string | null;
}

// Placeholder tenants for local development. Move to the database with real clients.
// Workspace ids appear in URLs (/admin/<workspace>), so "access" is reserved.
const WORKSPACES: Record<string, Workspace> = {
  fishbelly: { id: "fishbelly", name: "Fishbelly" },
  demo: { id: "demo", name: "Demo Brand" },
};

const BRANDS: Record<string, Brand> = {
  // Fishbelly's own storefront: the standalone /studio.
  fishbelly: {
    id: "fishbelly",
    workspaceId: "fishbelly",
    name: "Fishbelly",
    allowedOrigin: null,
    templateIds: ["fisherman_001"],
    theme: { accent: "#1f3a5f" },
    prompt: "",
    wordmark: "FISHBELLY",
  },
  demo: {
    id: "demo",
    workspaceId: "demo",
    name: "Demo Brand",
    allowedOrigin: "http://localhost:3000",
    templateIds: ["vase_001", "fisherman_001"],
    theme: { accent: "#1f3a5f" },
    prompt: "",
    wordmark: "DEMO BRAND",
  },
};

/** The brand behind the standalone /studio. */
export const STANDALONE_BRAND_ID = "fishbelly";

export function getBrand(id: string): Brand | null {
  return BRANDS[id] ?? null;
}

export function getWorkspace(id: string): Workspace | null {
  return WORKSPACES[id] ?? null;
}

export function listWorkspaces(): Workspace[] {
  return Object.values(WORKSPACES);
}

export function listBrands(workspaceId: string): Brand[] {
  return Object.values(BRANDS).filter((b) => b.workspaceId === workspaceId);
}
