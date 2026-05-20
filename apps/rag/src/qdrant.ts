import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './config.js';

export const qdrant = new QdrantClient({
  url: config.qdrantUrl,
  ...(config.qdrantApiKey ? { apiKey: config.qdrantApiKey } : {}),
});

/**
 * Inicializa la coleccion si no existe.
 * - Vector size: 1536 (text-embedding-3-small)
 * - Distance: Cosine (estándar para embeddings semanticos)
 * - Payload indexado para los campos que se filtran con frecuencia
 */
export async function ensureCollection(): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === config.qdrantCollection);

  if (!exists) {
    console.log(`[qdrant] creando coleccion "${config.qdrantCollection}"...`);
    await qdrant.createCollection(config.qdrantCollection, {
      vectors: {
        size: config.embedDim,
        distance: 'Cosine',
      },
    });

    // Indices de payload para filtros rapidos
    const indexFields: Array<{ field: string; schema: 'keyword' | 'integer' | 'float' | 'bool' }> = [
      { field: 'prop_id', schema: 'keyword' },
      { field: 'operation', schema: 'keyword' },
      { field: 'property_type', schema: 'keyword' },
      { field: 'zona', schema: 'keyword' },
      { field: 'barrio', schema: 'keyword' },
      { field: 'price_currency', schema: 'keyword' },
      { field: 'price', schema: 'float' },
      { field: 'bedrooms', schema: 'integer' },
      { field: 'bathrooms', schema: 'integer' },
      { field: 'area_m2', schema: 'float' },
      { field: 'has_image', schema: 'bool' },
    ];

    for (const { field, schema } of indexFields) {
      await qdrant.createPayloadIndex(config.qdrantCollection, {
        field_name: field,
        field_schema: schema,
      });
    }
    console.log(`[qdrant] coleccion lista con ${indexFields.length} indices de payload`);
  } else {
    console.log(`[qdrant] coleccion "${config.qdrantCollection}" ya existe`);
  }
}

export async function deleteCollection(): Promise<void> {
  try {
    await qdrant.deleteCollection(config.qdrantCollection);
    console.log(`[qdrant] coleccion "${config.qdrantCollection}" eliminada`);
  } catch (err) {
    console.error(`[qdrant] error eliminando: ${(err as Error).message}`);
  }
}
