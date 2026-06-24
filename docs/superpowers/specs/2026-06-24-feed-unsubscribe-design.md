# Feed Unsubscribe Design

## Goal

Allow an authenticated user to unsubscribe from a feed from either the feed
page or the Feed Organization list without deleting shared feed data or the
user's read and starred history.

## User Experience

An **Unsubscribe** command appears in two places:

- The feed page toolbar, beside the refresh command.
- Each subscription row on the Folders page under Feed Organization.

Selecting the command opens a compact confirmation dialog that names the feed
and explains that its articles and the user's read/starred history will be
preserved. Cancel closes the dialog without making a change.

Confirming disables the dialog controls while the request is running. On
success, the user is redirected to `/app`, where the removed subscription no
longer appears in the sidebar or reader scopes. A recoverable failure remains
visible in the dialog so the user can retry or cancel.

## Data Behavior

Unsubscribing hard-deletes only the user's matching `FeedSubscription` row.
The operation does not delete or modify:

- The shared `Feed` record.
- Stored `Article` records.
- The user's `ArticleState` read/starred history.
- Shared or cached article AI summaries.
- Other users' subscriptions to the same feed.

Because the unique user/feed subscription row is removed, the user can
subscribe to the feed again later. Existing article states then apply to the
restored subscription.

## Architecture

### Subscription Service

Add an ownership-checked unsubscribe function to
`src/lib/feed-subscriptions.ts`. It accepts `userId` and `subscriptionId`,
deletes only a row matching both values, and returns enough identifying data
for the caller to report success.

If no matching subscription exists, it throws `FeedSubscriptionError` with a
safe user-facing message. A subscription belonging to another user is treated
the same as a missing subscription.

### Server Action

Add an authenticated action to `src/app/app/actions.ts`. The action:

1. Requires a signed-in user.
2. Validates the submitted subscription ID.
3. Calls the ownership-checked service.
4. Revalidates surviving reader, folder, and settings paths on a best-effort
   basis.
5. Returns a structured success or error result to the confirmation dialog.

The client navigates to `/app` and refreshes on successful completion. The
deleted feed route is not revalidated, avoiding a Next.js 16 race that could
render a now-missing subscription. No destructive work is performed by the
client directly.

### Confirmation Component

Add one reusable client component for both entry points. It owns dialog state,
pending state, and action feedback. The trigger is rendered as a destructive
button with a trash/unsubscribe icon and an accessible feed-specific label.

The dialog uses the project's existing UI primitives and remains compact
enough for the feed toolbar and mobile layouts. It includes:

- The feed title.
- A clear statement that the subscription will be removed.
- A note that articles and read/starred history are preserved.
- Cancel and Unsubscribe commands.
- Inline action errors.

## Error Handling

- Unauthenticated requests return an authorization error.
- Empty subscription IDs return a validation error.
- Missing or foreign subscriptions return a generic not-found error.
- Unexpected database failures return a generic retry message and do not
  navigate.
- Repeated confirmation clicks are prevented while the action is pending.

## Testing

Service tests verify:

- A user can delete their own subscription.
- Another user's subscription cannot be deleted.
- Missing subscriptions return a safe error.
- The operation deletes no feed, article, or article-state records.

Server-action tests verify authentication, validation, service invocation,
path revalidation, and structured error handling.

Component tests verify:

- Both trigger placements can use the same component.
- The confirmation names the feed and explains history preservation.
- Cancel performs no action.
- Confirm submits the correct subscription ID.
- Pending and error states are rendered accessibly.

A browser smoke test verifies unsubscribe from the Feed Organization page,
resubscription/history behavior where practical, and feed-page access after a
test subscription is restored.

## Out of Scope

- Bulk unsubscribe.
- Deleting shared feeds or articles.
- Clearing personal article history.
- Soft-deleted or archived subscriptions.
- Automatic garbage collection for unused shared feeds.
