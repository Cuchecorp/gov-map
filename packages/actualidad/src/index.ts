// @obs/actualidad — capa de agrupación por materia (SEN-05) del panel de actualidad.
// k-means determinista sobre embeddings + label factual mode(materia). Sin LLM.
export {
  kmeans,
  labelCluster,
  KMEANS_SEED,
  DEFAULT_K,
  K_MIN,
  K_MAX,
  type KMeansResult,
} from "./kmeans";
