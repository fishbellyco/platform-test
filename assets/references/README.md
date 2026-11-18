# Reference images

Images that define a product's look. Templates list them by key (`referenceImages` in
`packages/core/src/template.ts`) and the pipeline passes the keys to the preview provider.
Mocks ignore them; the real image-model adapter loads them from here (a storage bucket on Supabase).

- `fisherman_001/lineup.jpg`: Fishbelly's fisherman lineup, the house style for the
  brand-agnostic fisherman figurine.
