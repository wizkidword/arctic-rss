export const TERMS_VERSION = "terms-v1"
export const PRIVACY_POLICY_VERSION = "privacy-v1"
export const ACCOUNT_DELETION_POLICY_VERSION = "account-deletion-v1"
export const CHAT_POLICY_VERSION = "launch-policy-v1"
export const RETENTION_POLICY_VERSION = "retention-v1"
export const COOKIE_POLICY_VERSION = "cookies-v1"
export const SECURITY_POLICY_VERSION = "security-v1"

// Deletion records created before the policy registry used the chat-policy
// version. Keep that value recognizable without rewriting historic evidence.
export const LEGACY_ACCOUNT_DELETION_POLICY_VERSION = CHAT_POLICY_VERSION
