/**
 * Verification is separate from parser confidence: it records *how* a published fact was
 * established. Confidence says how sure a parser was; verification says who/what vouched.
 */
import {
  isOfficialSourceType,
  type ContentStatus,
  type SourceDefinition,
  type ValidationStatus,
  type VerificationState,
} from '@gamepulse/domain';
import type { ParserKind } from './validate';

export interface PublicationDecision {
  /** Whether the candidate is stored at all (INVALID candidates are only logged). */
  store: boolean;
  status: ContentStatus;
  verification: VerificationState;
}

export function decidePublication(
  validation: ValidationStatus,
  source: SourceDefinition,
  parserKind: ParserKind,
): PublicationDecision {
  if (validation === 'INVALID')
    return { store: false, status: 'REJECTED', verification: 'REJECTED' };
  if (validation === 'REVIEW')
    return { store: true, status: 'PENDING_REVIEW', verification: 'UNVERIFIED' };

  if (source.type === 'MANUAL') {
    // An operator vouches for facts they typed, not for facts an AI extracted from pasted text.
    return {
      store: true,
      status: 'PUBLISHED',
      verification: parserKind === 'ai' ? 'UNVERIFIED' : 'MANUAL_VERIFIED',
    };
  }
  if (
    isOfficialSourceType(source.type) &&
    (parserKind === 'deterministic' || parserKind === 'ai')
  ) {
    // AI output reaches this point only with evidence verified against the source text.
    return { store: true, status: 'PUBLISHED', verification: 'AUTO_VERIFIED' };
  }
  return { store: true, status: 'PUBLISHED', verification: 'UNVERIFIED' };
}
