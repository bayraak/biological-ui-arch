// Breaches tissue-no-stores: a tissue must not import from stores/.
// Push the store read down into a constituent cell.
import { useCartStore } from '../stores/cart'

export const BadStoreImport = useCartStore
