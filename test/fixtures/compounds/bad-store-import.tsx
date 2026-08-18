// Breaches compound-no-stores: a compound (level 3) may import only atoms /
// molecules / other compounds — never a store (or any higher-level tier).
import { useCartStore } from '../stores/cart'

export const BadStoreImport = useCartStore
