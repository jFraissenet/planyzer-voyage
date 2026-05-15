import type { VoteStyle } from "@/lib/proposals/modes";
import type { VoteValue } from "@/lib/proposals";
import { VoteChips } from "./VoteChips";
import { VoteCheck } from "./VoteCheck";
import { VoteSingle } from "./VoteSingle";

// Single entry point used by ProposalCard / ProposalDetailModal — dispatches
// to the right vote UI based on the resolved vote style. Hides the value
// mapping ('for' | 'against' | 'neutral') from the caller for non-tri styles
// so each consumer just deals in toggle/pick semantics.

type Props = {
  style: VoteStyle;
  counts: { for: number; neutral: number; against: number };
  myVote: VoteValue | null;
  size?: "sm" | "md";
  disabled?: boolean;
  onSetVote: (value: VoteValue) => void;     // tri only
  onClearVote: () => void;                    // used by check/single to remove "for"
  // Tap on the count opens the voters modal. For tri the bucket the user
  // tapped on is forwarded so the modal can surface that section first.
  onShowVoters?: (focus: VoteValue | null) => void;
};

export function VoteWidget({
  style,
  counts,
  myVote,
  size = "md",
  disabled = false,
  onSetVote,
  onClearVote,
  onShowVoters,
}: Props) {
  if (style === "tri") {
    return (
      <VoteChips
        counts={counts}
        myVote={myVote}
        onVote={onSetVote}
        onClearVote={onClearVote}
        onShowVoters={onShowVoters ? () => onShowVoters(null) : undefined}
        size={size}
        disabled={disabled}
      />
    );
  }
  // Both check and single use only 'for' as the in-database value.
  const isMine = myVote === "for";
  const handle = () => {
    if (isMine) onClearVote();
    else onSetVote("for");
  };
  if (style === "check") {
    return (
      <VoteCheck
        count={counts.for}
        isMine={isMine}
        onToggle={handle}
        onShowVoters={onShowVoters ? () => onShowVoters(null) : undefined}
        size={size}
        disabled={disabled}
      />
    );
  }
  // single
  return (
    <VoteSingle
      count={counts.for}
      isMine={isMine}
      onPick={handle}
      onShowVoters={onShowVoters ? () => onShowVoters(null) : undefined}
      size={size}
      disabled={disabled}
    />
  );
}
