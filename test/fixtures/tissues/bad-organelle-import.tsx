// Breaches tissue-no-organelles: a tissue must reach an organelle THROUGH a cell,
// never import one directly (organelles live inside cells).
import { CartOrganelle } from '../organelles/cart'

export const BadOrganelleImport = CartOrganelle
