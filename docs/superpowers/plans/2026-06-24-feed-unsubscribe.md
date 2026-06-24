# Feed Unsubscribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmed unsubscribe workflow to feed pages and Feed Organization that deletes only the current user's subscription and preserves feed articles plus read/starred history.

**Architecture:** A focused subscription service performs an ownership-scoped `FeedSubscription` deletion. An authenticated Server Action exposes structured success/error state to one reusable client confirmation component, which appears in both requested UI locations and navigates to `/app` after success.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19 `useActionState`, Base UI Dialog, Prisma/PostgreSQL, Vitest, Docker Compose.

---

### Task 1: Ownership-Safe Subscription Deletion

**Files:**
- Modify: `src/lib/feed-subscriptions.test.ts`
- Modify: `src/lib/feed-subscriptions.ts`

- [x] **Step 1: Expand the subscription database mock**

Add focused mocks for lookup and deletion while retaining the existing list
test:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const deleteMany = vi.fn()
const findFirst = vi.fn()
const findMany = vi.fn()

const articleDeleteMany = vi.fn()
const articleStateDeleteMany = vi.fn()
const feedDelete = vi.fn()

vi.mock("./db", () => ({
  getPrisma: () => ({
    article: {
      deleteMany: articleDeleteMany,
    },
    articleState: {
      deleteMany: articleStateDeleteMany,
    },
    feed: {
      delete: feedDelete,
    },
    feedSubscription: {
      deleteMany,
      findFirst,
      findMany,
    },
  }),
}))
```

Reset the mocks before each test:

```ts
beforeEach(() => {
  articleDeleteMany.mockReset()
  articleStateDeleteMany.mockReset()
  deleteMany.mockReset()
  feedDelete.mockReset()
  findFirst.mockReset()
  findMany.mockReset()
})
```

- [x] **Step 2: Write failing service tests**

Import `unsubscribeFromFeed` and add:

```ts
it("deletes only the signed-in user's subscription", async () => {
  findFirst.mockResolvedValue({
    customTitle: null,
    feed: { title: "Example Feed" },
    id: "subscription-1",
  })
  deleteMany.mockResolvedValue({ count: 1 })

  await expect(
    unsubscribeFromFeed({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })
  ).resolves.toEqual({
    id: "subscription-1",
    title: "Example Feed",
  })

  expect(findFirst).toHaveBeenCalledWith({
    include: {
      feed: {
        select: { title: true },
      },
    },
    where: {
      id: "subscription-1",
      userId: "user-1",
    },
  })
  expect(deleteMany).toHaveBeenCalledWith({
    where: {
      id: "subscription-1",
      userId: "user-1",
    },
  })
  expect(feedDelete).not.toHaveBeenCalled()
  expect(articleDeleteMany).not.toHaveBeenCalled()
  expect(articleStateDeleteMany).not.toHaveBeenCalled()
})

it("does not delete a missing or foreign subscription", async () => {
  findFirst.mockResolvedValue(null)

  await expect(
    unsubscribeFromFeed({
      subscriptionId: "subscription-foreign",
      userId: "user-1",
    })
  ).rejects.toThrow("That feed subscription was not found.")

  expect(deleteMany).not.toHaveBeenCalled()
})

it("reports a subscription that disappears before deletion", async () => {
  findFirst.mockResolvedValue({
    customTitle: "Custom Feed",
    feed: { title: "Example Feed" },
    id: "subscription-1",
  })
  deleteMany.mockResolvedValue({ count: 0 })

  await expect(
    unsubscribeFromFeed({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })
  ).rejects.toThrow("That feed subscription was not found.")
})
```

- [x] **Step 3: Run the tests to verify RED**

Run:

```powershell
npm test -- src/lib/feed-subscriptions.test.ts
```

Expected: FAIL because `unsubscribeFromFeed` is not exported.

- [x] **Step 4: Implement the minimal ownership-scoped service**

Add to `src/lib/feed-subscriptions.ts`:

```ts
export async function unsubscribeFromFeed({
  subscriptionId,
  userId,
}: {
  subscriptionId: string
  userId: string
}) {
  const prisma = getPrisma()
  const subscription = await prisma.feedSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
    include: {
      feed: {
        select: { title: true },
      },
    },
  })

  if (!subscription) {
    throw new FeedSubscriptionError(
      "That feed subscription was not found."
    )
  }

  const result = await prisma.feedSubscription.deleteMany({
    where: {
      id: subscription.id,
      userId,
    },
  })

  if (result.count !== 1) {
    throw new FeedSubscriptionError(
      "That feed subscription was not found."
    )
  }

  return {
    id: subscription.id,
    title: subscription.customTitle || subscription.feed.title,
  }
}
```

- [x] **Step 5: Run the focused service tests**

Run:

```powershell
npm test -- src/lib/feed-subscriptions.test.ts
```

Expected: all feed subscription tests PASS.

- [x] **Step 6: Commit the service behavior**

```powershell
git add src/lib/feed-subscriptions.ts src/lib/feed-subscriptions.test.ts
git commit -m "Add ownership-safe feed unsubscribe service"
```

### Task 2: Authenticated Unsubscribe Server Action

**Files:**
- Modify: `src/app/app/actions.test.ts`
- Modify: `src/app/app/actions.ts`

> **Implementation note:** Next.js 16 can immediately refresh the current route
> when a Server Action calls `refresh()` or revalidates that route. The final
> implementation therefore invalidates only surviving reader/settings paths
> on a best-effort basis. The client navigates to `/app` and refreshes after a
> successful response, so the deleted feed route is never re-rendered.

- [x] **Step 1: Add the action error class, mock, and import**

Define this class inside the existing `vi.hoisted` callback:

```ts
class MockFeedSubscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedSubscriptionError"
  }
}
```

Return it from the hoisted callback and add the service mock:

```ts
MockFeedSubscriptionError,
unsubscribeFromFeed: vi.fn(),
```

Expose it from the feed-subscriptions mock:

```ts
vi.mock("@/lib/feed-subscriptions", () => ({
  FeedSubscriptionError: mocks.MockFeedSubscriptionError,
  getUserFeedSubscription: vi.fn(),
  subscribeToFeed: vi.fn(),
  unsubscribeFromFeed: mocks.unsubscribeFromFeed,
}))
```

Import `unsubscribeFeedAction` from `./actions`.

- [x] **Step 2: Write failing action tests**

Add:

```ts
describe("unsubscribeFeedAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.unsubscribeFromFeed.mockReset()
  })

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null)

    const result = await unsubscribeFeedAction(
      { message: "", status: "idle" },
      new FormData()
    )

    expect(result).toEqual({
      message: "You need to sign in before unsubscribing.",
      status: "error",
    })
    expect(mocks.unsubscribeFromFeed).not.toHaveBeenCalled()
  })

  it("requires a subscription ID", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })

    const result = await unsubscribeFeedAction(
      { message: "", status: "idle" },
      new FormData()
    )

    expect(result).toEqual({
      message: "Choose a feed to unsubscribe from.",
      status: "error",
    })
  })

  it("unsubscribes and invalidates reader paths", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.unsubscribeFromFeed.mockResolvedValue({
      id: "subscription-1",
      title: "Example Feed",
    })
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    const result = await unsubscribeFeedAction(
      { message: "", status: "idle" },
      formData
    )

    expect(mocks.unsubscribeFromFeed).toHaveBeenCalledWith({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/folders")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/feed/subscription-1"
    )
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Unsubscribed from Example Feed.",
      status: "success",
    })
  })

  it("returns safe service errors", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.unsubscribeFromFeed.mockRejectedValue(
      new mocks.MockFeedSubscriptionError(
        "That feed subscription was not found."
      )
    )
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    await expect(
      unsubscribeFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "That feed subscription was not found.",
      status: "error",
    })
  })

  it("returns a generic unexpected database error", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.unsubscribeFromFeed.mockRejectedValue(
      new Error("database unavailable")
    )
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    await expect(
      unsubscribeFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "Arctic RSS could not unsubscribe from that feed.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 3: Run the action tests to verify RED**

Run:

```powershell
npm test -- src/app/app/actions.test.ts
```

Expected: FAIL because the action and mock are missing.

- [x] **Step 4: Implement the action state and action**

Import `unsubscribeFromFeed` and add:

```ts
export type UnsubscribeFeedActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export async function unsubscribeFeedAction(
  _previousState: UnsubscribeFeedActionState,
  formData: FormData
): Promise<UnsubscribeFeedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before unsubscribing.",
      status: "error",
    }
  }

  const subscriptionId = String(
    formData.get("subscriptionId") ?? ""
  ).trim()

  if (!subscriptionId) {
    return {
      message: "Choose a feed to unsubscribe from.",
      status: "error",
    }
  }

  try {
    const subscription = await unsubscribeFromFeed({
      subscriptionId,
      userId: session.user.id,
    })

    revalidateReaderPaths()
    revalidateSettingsPaths()
    revalidatePath(`/app/feed/${subscriptionId}`)
    refresh()

    return {
      message: `Unsubscribed from ${subscription.title}.`,
      status: "success",
    }
  } catch (error) {
    if (error instanceof FeedSubscriptionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not unsubscribe from that feed.",
      status: "error",
    }
  }
}
```

- [x] **Step 5: Verify the focused action tests**

Run:

```powershell
npm test -- src/app/app/actions.test.ts
```

Expected: all action tests PASS.

- [x] **Step 6: Commit the Server Action**

```powershell
git add src/app/app/actions.ts src/app/app/actions.test.ts
git commit -m "Add feed unsubscribe server action"
```

### Task 3: Reusable Confirmation Dialog

**Files:**
- Create: `src/components/ui/alert-dialog.tsx`
- Create: `src/components/feed-unsubscribe-button.test.tsx`
- Create: `src/components/feed-unsubscribe-button.tsx`

- [x] **Step 1: Write the failing component tests**

Mock the alert-dialog wrappers as simple semantic containers and mock
`next/navigation` plus `unsubscribeFeedAction`. Test the exported content and
top-level component:

```tsx
it("names the feed and explains preserved history", () => {
  const markup = renderToStaticMarkup(
    <FeedUnsubscribeDialogContent
      action={() => undefined}
      feedTitle="Example Feed"
      pending={false}
      state={{ message: "", status: "idle" }}
      subscriptionId="subscription-1"
    />
  )

  expect(markup).toContain("Unsubscribe from Example Feed?")
  expect(markup).toContain(
    "Articles and your read and starred history will be preserved."
  )
  expect(markup).toContain('name="subscriptionId"')
  expect(markup).toContain('value="subscription-1"')
  expect(markup).toContain("Cancel")
  expect(markup).toContain('type="button"')
  expect(markup).toContain("Unsubscribe")
})

it("disables confirmation and shows errors", () => {
  const markup = renderToStaticMarkup(
    <FeedUnsubscribeDialogContent
      action={() => undefined}
      feedTitle="Example Feed"
      pending
      state={{
        message: "That feed subscription was not found.",
        status: "error",
      }}
      subscriptionId="subscription-1"
    />
  )

  expect(markup).toContain("Unsubscribing")
  expect(markup).toContain("disabled")
  expect(markup).toContain(
    "That feed subscription was not found."
  )
})

it("renders a destructive feed-specific trigger", () => {
  const markup = renderToStaticMarkup(
    <FeedUnsubscribeButton
      feedTitle="Example Feed"
      subscriptionId="subscription-1"
    />
  )

  expect(markup).toContain("Unsubscribe")
  expect(markup).toContain("Example Feed")
})
```

- [x] **Step 2: Run the component test to verify RED**

Run:

```powershell
npm test -- src/components/feed-unsubscribe-button.test.tsx
```

Expected: FAIL because the component files do not exist.

- [x] **Step 3: Add the Base UI alert-dialog wrappers**

Create `src/components/ui/alert-dialog.tsx` using
`@base-ui/react/dialog`, following `sheet.tsx`:

```tsx
"use client"

import * as React from "react"
import { Dialog as AlertDialogPrimitive } from "@base-ui/react/dialog"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root {...props} />
}

function AlertDialogTrigger(
  props: AlertDialogPrimitive.Trigger.Props
) {
  return <AlertDialogPrimitive.Trigger {...props} />
}

function AlertDialogClose(props: AlertDialogPrimitive.Close.Props) {
  return <AlertDialogPrimitive.Close {...props} />
}

function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <AlertDialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-popover p-5 text-popover-foreground shadow-lg outline-none transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader(props: React.ComponentProps<"div">) {
  return <div className="grid gap-2" {...props} />
}

function AlertDialogFooter(props: React.ComponentProps<"div">) {
  return (
    <div
      className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      {...props}
    />
  )
}

function AlertDialogTitle(
  props: AlertDialogPrimitive.Title.Props
) {
  return (
    <AlertDialogPrimitive.Title
      className="font-heading text-base font-semibold"
      {...props}
    />
  )
}

function AlertDialogDescription(
  props: AlertDialogPrimitive.Description.Props
) {
  return (
    <AlertDialogPrimitive.Description
      className="text-sm text-muted-foreground"
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      render={<Button className={className} variant="outline" />}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
}
```

- [x] **Step 4: Implement the reusable unsubscribe component**

Create `src/components/feed-unsubscribe-button.tsx`:

```tsx
"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon } from "lucide-react"

import {
  unsubscribeFeedAction,
  type UnsubscribeFeedActionState,
} from "@/app/app/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

const initialState: UnsubscribeFeedActionState = {
  message: "",
  status: "idle",
}

export function FeedUnsubscribeButton({
  feedTitle,
  subscriptionId,
}: {
  feedTitle: string
  subscriptionId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(
    unsubscribeFeedAction,
    initialState
  )

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false)
      router.replace("/app")
      router.refresh()
    }
  }, [router, state.status])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="destructive" />}
      >
        <Trash2Icon data-icon="inline-start" />
        Unsubscribe
        <span className="sr-only"> from {feedTitle}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <FeedUnsubscribeDialogContent
          action={action}
          feedTitle={feedTitle}
          pending={pending}
          state={state}
          subscriptionId={subscriptionId}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function FeedUnsubscribeDialogContent({
  action,
  feedTitle,
  pending,
  state,
  subscriptionId,
}: {
  action: React.ComponentProps<"form">["action"]
  feedTitle: string
  pending: boolean
  state: UnsubscribeFeedActionState
  subscriptionId: string
}) {
  return (
    <form action={action} className="grid gap-4">
      <input
        name="subscriptionId"
        type="hidden"
        value={subscriptionId}
      />
      <AlertDialogHeader>
        <AlertDialogTitle>
          Unsubscribe from {feedTitle}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          The feed will leave your reader. Articles and your read and
          starred history will be preserved.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {state.status === "error" && (
        <p aria-live="polite" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} type="button">
          Cancel
        </AlertDialogCancel>
        <Button disabled={pending} type="submit" variant="destructive">
          <Trash2Icon data-icon="inline-start" />
          {pending ? "Unsubscribing" : "Unsubscribe"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
```

Import `type React` or the specific `ComponentProps` type so the file
type-checks without relying on the global namespace.

- [x] **Step 5: Run the focused component tests**

Run:

```powershell
npm test -- src/components/feed-unsubscribe-button.test.tsx
npm run typecheck
```

Expected: both PASS.

- [x] **Step 6: Commit the reusable UI**

```powershell
git add src/components/ui/alert-dialog.tsx src/components/feed-unsubscribe-button.tsx src/components/feed-unsubscribe-button.test.tsx
git commit -m "Add feed unsubscribe confirmation dialog"
```

### Task 4: Place Unsubscribe In Both Requested Locations

**Files:**
- Create: `src/app/app/feed/[subscriptionId]/page.test.tsx`
- Create: `src/app/app/folders/page.test.tsx`
- Modify: `src/app/app/feed/[subscriptionId]/page.tsx`
- Modify: `src/app/app/folders/page.tsx`

- [x] **Step 1: Write a failing feed-page placement test**

Mock authentication, subscription/article/settings data, and
`ReaderSurface`. Render the toolbar passed into the mocked reader:

```tsx
vi.mock("@/components/feed-unsubscribe-button", () => ({
  FeedUnsubscribeButton: ({
    feedTitle,
    subscriptionId,
  }: {
    feedTitle: string
    subscriptionId: string
  }) => (
    <span>
      Unsubscribe {feedTitle} {subscriptionId}
    </span>
  ),
}))

it("places unsubscribe beside the feed toolbar actions", async () => {
  const markup = renderToStaticMarkup(
    await FeedPage({
      params: Promise.resolve({
        subscriptionId: "subscription-1",
      }),
      searchParams: Promise.resolve({}),
    })
  )

  expect(markup).toContain(
    "Unsubscribe Example Feed subscription-1"
  )
})
```

- [x] **Step 2: Write a failing Feed Organization placement test**

Mock `auth`, `listUserFolders`, and `listUserFeedSubscriptions`, returning one
subscription. Mock `FeedUnsubscribeButton` as above:

```tsx
it("places unsubscribe on every Feed Organization row", async () => {
  const markup = renderToStaticMarkup(await FoldersPage())

  expect(markup).toContain(
    "Unsubscribe Example Feed subscription-1"
  )
})
```

- [x] **Step 3: Run placement tests to verify RED**

Run:

```powershell
npm test -- "src/app/app/feed/[subscriptionId]/page.test.tsx" src/app/app/folders/page.test.tsx
```

Expected: FAIL because neither page renders the component.

- [x] **Step 4: Add the feed-page toolbar command**

Import `FeedUnsubscribeButton` and append:

```tsx
<FeedUnsubscribeButton
  feedTitle={title}
  subscriptionId={subscription.id}
/>
```

after `FeedRefreshButton` inside the toolbar fragment.

- [x] **Step 5: Add the Feed Organization row command**

Import `FeedUnsubscribeButton`, change the row grid to reserve an action
column, and add:

```tsx
<FeedUnsubscribeButton
  feedTitle={subscription.title}
  subscriptionId={subscription.id}
/>
```

Use:

```tsx
className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,420px)_auto]"
```

so the destructive action is separate from the move form.

- [x] **Step 6: Run placement and focused feature tests**

Run:

```powershell
npm test -- "src/app/app/feed/[subscriptionId]/page.test.tsx" src/app/app/folders/page.test.tsx src/components/feed-unsubscribe-button.test.tsx src/app/app/actions.test.ts src/lib/feed-subscriptions.test.ts
npm run typecheck
npm run lint
```

Expected: all commands PASS.

- [x] **Step 7: Commit both placements**

```powershell
git add src/app/app/feed/[subscriptionId]/page.tsx src/app/app/feed/[subscriptionId]/page.test.tsx src/app/app/folders/page.tsx src/app/app/folders/page.test.tsx
git commit -m "Expose unsubscribe in feed management"
```

### Task 5: Full Verification And Production Deployment

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-24-feed-unsubscribe.md`

- [x] **Step 1: Document the completed capability**

Add to the README completed-feature list:

```markdown
- Confirmed feed unsubscribe from feed pages and Feed Organization
- Subscription removal that preserves shared articles and personal read/starred history
```

- [x] **Step 2: Run the full repository verification**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npx prisma validate
npm run build
docker compose config --quiet
```

Expected: 0 test failures and all commands exit successfully.

- [x] **Step 3: Commit documentation and checklist**

Mark completed plan items, then:

```powershell
git add README.md docs/superpowers/plans/2026-06-24-feed-unsubscribe.md
git commit -m "Document feed unsubscribe support"
```

- [ ] **Step 4: Rebuild the production application**

Run:

```powershell
docker compose up -d --build web worker
docker compose ps
```

Expected: PostgreSQL, Redis, and web are healthy; worker is running.

- [ ] **Step 5: Seed isolated QA records**

Run this through the worker container so it uses the Compose database address:

```powershell
$qaJson = @'
import { getPrisma } from "./src/lib/db"
import { hashPassword } from "./src/lib/password"
import { defaultUserSettings } from "./src/lib/settings"

const prisma = getPrisma()
const suffix = Date.now().toString()
const email = `unsubscribe-qa-${suffix}@arcticrss.local`
const password = `Qa-Unsubscribe-${suffix}!`

const user = await prisma.user.create({
  data: {
    email,
    name: "Unsubscribe QA",
    passwordHash: await hashPassword(password),
    settings: { create: defaultUserSettings() },
  },
})
const feed = await prisma.feed.create({
  data: {
    feedUrl: `https://example.com/arctic-rss-unsubscribe-${suffix}.xml`,
    siteUrl: "https://example.com",
    title: "Unsubscribe QA Feed",
  },
})
const article = await prisma.article.create({
  data: {
    externalId: `unsubscribe-qa-${suffix}`,
    feedId: feed.id,
    title: "Preserved QA Article",
    url: `https://example.com/arctic-rss-unsubscribe-${suffix}`,
  },
})
const subscription = await prisma.feedSubscription.create({
  data: {
    feedId: feed.id,
    userId: user.id,
  },
})
await prisma.articleState.create({
  data: {
    articleId: article.id,
    isRead: true,
    isStarred: true,
    readAt: new Date(),
    starredAt: new Date(),
    userId: user.id,
  },
})

console.log(JSON.stringify({
  articleId: article.id,
  email,
  feedId: feed.id,
  password,
  subscriptionId: subscription.id,
  userId: user.id,
}))
await prisma.$disconnect()
'@ | docker compose exec -T worker npx tsx -

$qa = $qaJson | Select-Object -Last 1 | ConvertFrom-Json
$env:QA_ARTICLE_ID = $qa.articleId
$env:QA_EMAIL = $qa.email
$env:QA_FEED_ID = $qa.feedId
$env:QA_PASSWORD = $qa.password
$env:QA_SUBSCRIPTION_ID = $qa.subscriptionId
$env:QA_USER_ID = $qa.userId
$qa
```

Keep the single JSON output for Step 6. Do not modify the owner's real
subscriptions.

- [ ] **Step 6: Browser-smoke both UI entry points**

Using the isolated QA account and credentials from Step 5:

1. Confirm the Feed Organization row shows Unsubscribe.
2. Open its confirmation and verify the preservation message.
3. Cancel and confirm the subscription remains.
4. Open the feed page and confirm its toolbar also shows Unsubscribe.
5. Confirm unsubscribe and verify navigation to `/app`.
6. Confirm the subscription disappears.
7. Confirm there are no relevant browser console errors.

Then verify preservation using the IDs from Step 5:

```powershell
@'
import { getPrisma } from "./src/lib/db"

const prisma = getPrisma()
const subscriptionId = process.env.QA_SUBSCRIPTION_ID!
const feedId = process.env.QA_FEED_ID!
const articleId = process.env.QA_ARTICLE_ID!
const userId = process.env.QA_USER_ID!

const counts = {
  article: await prisma.article.count({ where: { id: articleId } }),
  articleState: await prisma.articleState.count({
    where: { articleId, userId },
  }),
  feed: await prisma.feed.count({ where: { id: feedId } }),
  subscription: await prisma.feedSubscription.count({
    where: { id: subscriptionId },
  }),
}
console.log(JSON.stringify(counts))

if (
  counts.subscription !== 0 ||
  counts.feed !== 1 ||
  counts.article !== 1 ||
  counts.articleState !== 1
) {
  throw new Error("Unsubscribe preservation verification failed.")
}

await prisma.user.delete({ where: { id: userId } })
await prisma.feed.delete({ where: { id: feedId } })
await prisma.$disconnect()
'@ | docker compose exec -T `
  -e QA_SUBSCRIPTION_ID="$env:QA_SUBSCRIPTION_ID" `
  -e QA_FEED_ID="$env:QA_FEED_ID" `
  -e QA_ARTICLE_ID="$env:QA_ARTICLE_ID" `
  -e QA_USER_ID="$env:QA_USER_ID" `
  worker npx tsx -
```

Expected JSON:

```json
{"article":1,"articleState":1,"feed":1,"subscription":0}
```

- [ ] **Step 7: Verify public health and repository state**

Run:

```powershell
curl.exe --fail https://arcticrss.taverncellar.com/api/health
git status --short
git log --oneline -6
```

Expected: public health is `ok` and the worktree is clean.

- [ ] **Step 8: Push the completed feature**

```powershell
git push origin main
```

Expected: the remote `main` branch contains every unsubscribe commit.
