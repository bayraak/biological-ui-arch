import atomNoDeps from './rules/atom-no-deps'
import cellMustBeStateful from './rules/cell-must-be-stateful'
import cellMustNotComposeCell from './rules/cell-must-not-compose-cell'
import cellNoTissues from './rules/cell-no-tissues'
import cellsFolderIndexIsBarrel from './rules/cells-folder-index-is-barrel'
import compoundMustBeStateless from './rules/compound-must-be-stateless'
import compoundNoStores from './rules/compound-no-stores'
import effectHookNaming from './rules/effect-hook-naming'
import moleculeAtomsOnly from './rules/molecule-atoms-only'
import moleculeMustCompose from './rules/molecule-must-compose'
import noBrandNames from './rules/no-brand-names'
import noCardShapedDiv from './rules/no-card-shaped-div'
import noCrossFeatureStores from './rules/no-cross-feature-stores'
import noDuplicateJsxPatterns from './rules/no-duplicate-jsx-patterns'
import nextRouteSegmentIsThinDelegate from './rules/next-route-segment-is-thin-delegate'
import noHookInComponentDisguise from './rules/no-hook-in-component-disguise'
import noInertHiddenJsx from './rules/no-inert-hidden-jsx'
import noTrivialWrapperComponent from './rules/no-trivial-wrapper-component'
import noInlineDataInJsx from './rules/no-inline-data-in-jsx'
import noInvalidFeatureFolders from './rules/no-invalid-feature-folders'
import noLogicInComponentFiles from './rules/no-logic-in-component-files'
import noRawHtmlAtoms from './rules/no-raw-html-atoms'
import noReactNamespace from './rules/no-react-namespace'
import noRenamedHtmlProps from './rules/no-renamed-html-props'
import noRenderPropReader from './rules/no-render-prop-reader'
import noTsInBioFolders from './rules/no-ts-in-bio-folders'
import noTypeDefinitionsInComponents from './rules/no-type-definitions-in-components'
import organelleDependency from './rules/organelle-dependency'
import organelleSingleSource from './rules/organelle-single-source'
import tissueMustCompose from './rules/tissue-must-compose'
import tissueNoDataProps from './rules/tissue-no-data-props'
import tissueNoHooks from './rules/tissue-no-hooks'
import tissueNoOrganelles from './rules/tissue-no-organelles'
import tissueNoStores from './rules/tissue-no-stores'
import zustandV5BestPractices from './rules/zustand-v5-best-practices'

export const rules = {
  'atom-no-deps': atomNoDeps,
  'cell-must-be-stateful': cellMustBeStateful,
  'cell-must-not-compose-cell': cellMustNotComposeCell,
  'cell-no-tissues': cellNoTissues,
  'cells-folder-index-is-barrel': cellsFolderIndexIsBarrel,
  'compound-must-be-stateless': compoundMustBeStateless,
  'compound-no-stores': compoundNoStores,
  'effect-hook-naming': effectHookNaming,
  'molecule-atoms-only': moleculeAtomsOnly,
  'molecule-must-compose': moleculeMustCompose,
  'no-brand-names': noBrandNames,
  'no-card-shaped-div': noCardShapedDiv,
  'no-cross-feature-stores': noCrossFeatureStores,
  'next-route-segment-is-thin-delegate': nextRouteSegmentIsThinDelegate,
  'no-duplicate-jsx-patterns': noDuplicateJsxPatterns,
  'no-hook-in-component-disguise': noHookInComponentDisguise,
  'no-inert-hidden-jsx': noInertHiddenJsx,
  'no-trivial-wrapper-component': noTrivialWrapperComponent,
  'no-inline-data-in-jsx': noInlineDataInJsx,
  'no-invalid-feature-folders': noInvalidFeatureFolders,
  'no-logic-in-component-files': noLogicInComponentFiles,
  'no-raw-html-atoms': noRawHtmlAtoms,
  'no-react-namespace': noReactNamespace,
  'no-renamed-html-props': noRenamedHtmlProps,
  'no-render-prop-reader': noRenderPropReader,
  'no-ts-in-bio-folders': noTsInBioFolders,
  'no-type-definitions-in-components': noTypeDefinitionsInComponents,
  'organelle-dependency': organelleDependency,
  'organelle-single-source': organelleSingleSource,
  'tissue-must-compose': tissueMustCompose,
  'tissue-no-data-props': tissueNoDataProps,
  'tissue-no-hooks': tissueNoHooks,
  'tissue-no-organelles': tissueNoOrganelles,
  'tissue-no-stores': tissueNoStores,
  'zustand-v5-best-practices': zustandV5BestPractices,
}

const plugin = {
  meta: {
    name: 'biological-ui-arch',
    version: '0.1.0',
  },
  rules,
}

export default plugin
