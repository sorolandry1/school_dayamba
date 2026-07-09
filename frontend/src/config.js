// Configuration produit (build-time).
// Mode mono-établissement : 1 école par installation (déploiement local).
// Masque les écrans multi-établissements. Le backend applique la même règle
// (settings.SINGLE_SCHOOL_MODE) — les deux doivent rester cohérents.
export const SINGLE_SCHOOL_MODE =
  (process.env.REACT_APP_SINGLE_SCHOOL_MODE ?? 'true').toLowerCase() !== 'false';
