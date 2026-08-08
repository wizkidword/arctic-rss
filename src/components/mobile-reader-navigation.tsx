"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { MenuIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type {
  ShellArticleCollection,
  ShellDiscoverInterest,
  ShellFeedSubscription,
  ShellFolder,
  ShellReaderCounts,
} from "@/components/reader-navigation"

const MobileReaderNav = dynamic(
  () =>
    import("@/components/reader-navigation").then(
      ({ ReaderNav }) => ReaderNav
    ),
  { ssr: false }
)

export function MobileReaderNavigation({
  articleCollections,
  chatEnabled = false,
  discoverInterests,
  feedSubscriptions,
  folders,
  guestMode = false,
  readerCounts,
}: {
  articleCollections: ShellArticleCollection[]
  chatEnabled?: boolean
  discoverInterests: ShellDiscoverInterest[]
  feedSubscriptions: ShellFeedSubscription[]
  folders: ShellFolder[]
  guestMode?: boolean
  readerCounts: ShellReaderCounts
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" />}>
        <MenuIcon />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      {open ? (
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Arctic RSS</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <MobileReaderNav
              articleCollections={articleCollections}
              chatEnabled={chatEnabled}
              discoverInterests={discoverInterests}
              feedSubscriptions={feedSubscriptions}
              folders={folders}
              guestMode={guestMode}
              readerCounts={readerCounts}
            />
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  )
}
