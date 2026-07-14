import { getApprovedPolicyMarkdown, type ApprovedPolicyKey } from "@/lib/approved-policy"

type ApprovedPolicyDocumentProps = {
  policy: ApprovedPolicyKey
}

function renderLine(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  )
}

export function ApprovedPolicyDocument({ policy }: ApprovedPolicyDocumentProps) {
  const lines = getApprovedPolicyMarkdown(policy).split("\n")

  return (
    <div className="flex flex-col gap-4 text-sm leading-7 text-slate-600">
      {lines.map((line, index) => {
        if (line.startsWith("### ")) {
          return (
            <h2
              className="mt-4 font-heading text-xl font-semibold tracking-normal text-slate-950 first:mt-0"
              key={`${line}-${index}`}
            >
              {line.slice(4)}
            </h2>
          )
        }

        if (line.startsWith("#### ")) {
          return (
            <h3 className="mt-3 text-base font-semibold text-slate-900" key={`${line}-${index}`}>
              {line.slice(5)}
            </h3>
          )
        }

        if (line.startsWith("- ")) {
          return (
            <p className="pl-5 before:-ml-5 before:mr-3 before:content-['•']" key={`${line}-${index}`}>
              {renderLine(line.slice(2))}
            </p>
          )
        }

        if (/^\d+\. /.test(line)) {
          return (
            <p className="pl-7" key={`${line}-${index}`}>
              {renderLine(line)}
            </p>
          )
        }

        if (line.startsWith("|")) {
          return (
            <p className="overflow-x-auto font-mono text-xs leading-6 text-slate-500" key={`${line}-${index}`}>
              {line}
            </p>
          )
        }

        if (!line.trim() || line === "---") {
          return null
        }

        return <p key={`${line}-${index}`}>{renderLine(line)}</p>
      })}
    </div>
  )
}
