// Stable public action surface. Each domain module is independently marked as
// a Server Action boundary so this file can safely preserve existing imports.
export {
  addFeedAction,
  bulkFeedAttentionAction,
  refreshFeedAction,
  setFeedPausedAction,
  subscribeDirectoryFeedAction,
  unsubscribeFeedAction,
} from "./actions/feeds"
export type {
  AddFeedActionState,
  BulkFeedAttentionActionState,
  RefreshFeedActionState,
  SetFeedPausedActionState,
  SourceSubscriptionAnalytics,
  SubscribeDirectoryFeedActionState,
  UnsubscribeFeedActionState,
} from "./actions/feeds"

export {
  createFolderAction,
  deleteFolderAction,
  moveSubscriptionToFolderAction,
  renameFolderAction,
} from "./actions/folders"

export {
  cancelOpmlImportAction,
  importOpmlAction,
  retryOpmlImportAction,
} from "./actions/imports"
export type { ImportOpmlActionState } from "./actions/imports"

export {
  updateDateTimePreferences,
  updateDefaultView,
  updateDisplayMode,
  updateThemePreference,
} from "./actions/settings"

export { resendEmailVerificationAction } from "./actions/account"
export type { ResendEmailVerificationActionState } from "./actions/account"

export {
  submitBugReportAction,
  submitFeatureSuggestionAction,
} from "./actions/feedback"
export type {
  SubmitBugReportActionState,
  SubmitFeatureSuggestionActionState,
} from "./actions/feedback"

export {
  addArticleToCollectionAction,
  addPodcastEpisodeToCollectionAction,
  cancelBulkReadAction,
  deleteArticleAction,
  markAllReadAction,
  markArticleReadOnOpen,
  removeArticleFromCollectionAction,
  removePodcastEpisodeFromCollectionAction,
  setArticleReadAction,
  setArticleStarredAction,
} from "./actions/articles"
export type {
  AddArticleToCollectionActionState,
  AddPodcastEpisodeToCollectionActionState,
} from "./actions/articles"

export {
  dismissStoryClusterAction,
  evaluateStoryClusterAction,
  generateAiDigestAction,
  generateArticleSummaryAction,
  generateStoryClusterAnalysisAction,
  mergeStoryClustersAction,
  splitStoryClusterMemberAction,
  updateAiPreferencesAction,
} from "./actions/ai"
export type {
  DismissStoryClusterActionState,
  EvaluateStoryClusterActionState,
  GenerateAiDigestActionState,
  GenerateArticleSummaryActionState,
  GenerateStoryClusterAnalysisActionState,
  MergeStoryClustersActionState,
  SplitStoryClusterMemberActionState,
  UpdateAiPreferencesActionState,
} from "./actions/ai"
