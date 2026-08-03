"use client"

import Link from "next/link"
import { BugIcon, FileTextIcon, HelpCircleIcon, LightbulbIcon, MailIcon } from "lucide-react"
import { useState } from "react"

import { BugReportDialog } from "@/components/bug-report-dialog"
import { FeatureSuggestionDialog } from "@/components/feature-suggestion-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { legalLinks } from "@/lib/legal-links"
import { cn } from "@/lib/utils"

const supportEmailAddress = "support@arcticrss.com"
const supportMailtoHref = `mailto:${supportEmailAddress}?subject=Arctic%20RSS%20Support`

export function AppShellHelpMenu() {
  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [featureSuggestionOpen, setFeatureSuggestionOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
              )}
              type="button"
              variant="ghost"
            />
          }
        >
          <HelpCircleIcon data-icon="inline-start" />
          <span className="truncate">Help</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Help</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setBugReportOpen(true)}>
              <BugIcon data-icon="inline-start" />
              Report a bug
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFeatureSuggestionOpen(true)}>
              <LightbulbIcon data-icon="inline-start" />
              Suggest a feature
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <a href={supportMailtoHref} rel="noreferrer" target="_blank" />
              }
            >
              <MailIcon data-icon="inline-start" />
              Contact support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {legalLinks.map((item) => (
              <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                <FileTextIcon data-icon="inline-start" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BugReportDialog onOpenChange={setBugReportOpen} open={bugReportOpen} />
      <FeatureSuggestionDialog
        onOpenChange={setFeatureSuggestionOpen}
        open={featureSuggestionOpen}
      />
    </>
  )
}
