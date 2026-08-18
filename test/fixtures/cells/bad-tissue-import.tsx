// Breaches cell-no-tissues: a cell must not import a higher-level tissue.
// Direction is wrong — tissues compose cells, not the reverse.
import { SiteHeader } from '../tissues/site-header'

export const BadTissueImport = SiteHeader
